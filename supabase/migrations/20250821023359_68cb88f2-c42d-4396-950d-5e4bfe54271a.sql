-- Remove the problematic view entirely and rely on secure functions
DROP VIEW IF EXISTS public.calendar_integrations_secure;

-- Phase 3: Final migration to encrypt existing tokens (if any exist)
-- Create a migration function to encrypt existing plain-text tokens
CREATE OR REPLACE FUNCTION public.migrate_existing_tokens_to_encrypted()
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  integration_record RECORD;
  encrypted_access TEXT;
  encrypted_refresh TEXT;
  migration_count INTEGER := 0;
BEGIN
  -- Only run if called by an authenticated user with parent role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can run token migration');
  END IF;

  -- Find integrations with potentially unencrypted tokens
  -- (tokens that don't contain our salt separator '::')
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.calendar_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
  LOOP
    BEGIN
      -- Encrypt the existing tokens
      encrypted_access := public.encrypt_oauth_token(integration_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF integration_record.refresh_token IS NOT NULL THEN
        encrypted_refresh := public.encrypt_oauth_token(integration_record.refresh_token, 'refresh');
      END IF;

      -- Update with encrypted versions
      UPDATE public.calendar_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = encrypted_refresh,
        updated_at = NOW()
      WHERE id = integration_record.id;

      migration_count := migration_count + 1;

      -- Log the migration
      PERFORM public.create_audit_log(
        (SELECT p.family_id FROM public.profiles p 
         JOIN public.calendar_integrations ci ON ci.profile_id = p.id 
         WHERE ci.id = integration_record.id),
        auth.uid(),
        'calendar_tokens_migrated_to_encrypted',
        'calendar_integrations',
        integration_record.id,
        NULL,
        json_build_object('migrated_at', NOW(), 'migration_version', '1.0')
      );

    EXCEPTION
      WHEN OTHERS THEN
        -- Log migration failure but continue with other records
        PERFORM public.create_audit_log(
          NULL,
          auth.uid(),
          'calendar_token_migration_failed',
          'calendar_integrations',
          integration_record.id,
          NULL,
          json_build_object('error', SQLERRM, 'failed_at', NOW())
        );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'migrated_count', migration_count,
    'message', 'Token encryption migration completed'
  );
END;
$$;

-- Create a function to check token encryption status
CREATE OR REPLACE FUNCTION public.get_token_encryption_status()
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_integrations INTEGER;
  encrypted_integrations INTEGER;
  user_family_id UUID;
BEGIN
  -- Get current user's family
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_family_id IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;

  -- Count total integrations in family
  SELECT COUNT(*) INTO total_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;

  -- Count encrypted integrations (those with salt separator)
  SELECT COUNT(*) INTO encrypted_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  AND ci.access_token LIKE '%::%';

  RETURN json_build_object(
    'total_integrations', total_integrations,
    'encrypted_integrations', encrypted_integrations,
    'unencrypted_integrations', total_integrations - encrypted_integrations,
    'encryption_complete', (total_integrations = encrypted_integrations)
  );
END;
$$;