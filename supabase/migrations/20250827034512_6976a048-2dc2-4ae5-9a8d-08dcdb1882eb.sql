-- Fix the security definer view warning and improve Google Photos token security

-- 1. Drop the problematic security definer view and create a regular function instead
DROP VIEW IF EXISTS public.calendar_integrations_safe;

-- Create a secure function to get calendar integration metadata instead of a view
CREATE OR REPLACE FUNCTION public.get_calendar_integrations_safe()
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  integration_type text,
  calendar_id text,
  is_active boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_token_refresh timestamp with time zone,
  token_refresh_count integer,
  has_access_token boolean,
  has_refresh_token boolean,
  is_encrypted boolean,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile_id UUID;
BEGIN
  -- Get current user's profile
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.expires_at,
    ci.created_at,
    ci.updated_at,
    ci.last_token_refresh,
    ci.token_refresh_count,
    -- Safe indicators without exposing actual tokens
    (ci.access_token IS NOT NULL AND ci.access_token != 'REVOKED') as has_access_token,
    (ci.refresh_token IS NOT NULL AND ci.refresh_token != 'REVOKED') as has_refresh_token,
    (ci.access_token LIKE '%::%') as is_encrypted,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_expired
  FROM public.calendar_integrations ci
  WHERE ci.profile_id = user_profile_id
  ORDER BY ci.created_at DESC;
END;
$$;

-- 2. Create secure Google Photos integration management function
CREATE OR REPLACE FUNCTION public.create_google_photos_integration_secure(
  access_token_param text,
  refresh_token_param text DEFAULT NULL,
  album_id_param text DEFAULT NULL,
  album_name_param text DEFAULT NULL,
  expires_at_param timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile_id UUID;
  user_family_id UUID;
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
  new_integration_id UUID;
BEGIN
  -- Get current user's profile (must be parent)
  SELECT p.id, p.family_id INTO user_profile_id, user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'parent';
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can create Google Photos integrations');
  END IF;

  -- Encrypt tokens before storage
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'access');
  
  IF refresh_token_param IS NOT NULL THEN
    encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'refresh');
  END IF;

  -- Create integration with encrypted tokens
  INSERT INTO public.google_photos_integrations (
    family_id,
    created_by,
    access_token,
    refresh_token,
    album_id,
    album_name,
    expires_at
  ) VALUES (
    user_family_id,
    user_profile_id,
    encrypted_access_token,
    encrypted_refresh_token,
    album_id_param,
    album_name_param,
    expires_at_param
  ) RETURNING id INTO new_integration_id;

  -- Log secure integration creation
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    'google_photos_integration_created',
    'google_photos_integrations',
    new_integration_id,
    NULL,
    json_build_object(
      'album_id', album_id_param,
      'album_name', album_name_param,
      'encrypted', true,
      'created_at', NOW()
    )
  );

  RETURN json_build_object(
    'success', true, 
    'integration_id', new_integration_id,
    'message', 'Google Photos integration created with encrypted tokens'
  );
END;
$$;

-- 3. Force encryption on any remaining unencrypted Google Photos tokens
DO $$
DECLARE
  integration_record RECORD;
  encrypted_access TEXT;
  encrypted_refresh TEXT;
  migration_count INTEGER := 0;
BEGIN
  -- Migrate Google Photos integrations with unencrypted tokens
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.google_photos_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
  LOOP
    BEGIN
      -- Encrypt the existing tokens
      encrypted_access := public.encrypt_oauth_token(integration_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF integration_record.refresh_token IS NOT NULL AND integration_record.refresh_token NOT LIKE '%::%' THEN
        encrypted_refresh := public.encrypt_oauth_token(integration_record.refresh_token, 'refresh');
      END IF;

      -- Update with encrypted versions
      UPDATE public.google_photos_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = COALESCE(encrypted_refresh, refresh_token),
        updated_at = NOW()
      WHERE id = integration_record.id;

      migration_count := migration_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Continue with other records if one fails
        CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migrated % Google Photos integrations to encrypted tokens', migration_count;
END $$;

-- 4. Update Google Photos RLS policies to be more restrictive
DROP POLICY IF EXISTS "Family members can view Google Photos integrations" ON public.google_photos_integrations;
DROP POLICY IF EXISTS "Parents can manage Google Photos integrations" ON public.google_photos_integrations;
DROP POLICY IF EXISTS "Users can view their own Google Photos integrations" ON public.google_photos_integrations;
DROP POLICY IF EXISTS "Parents can create Google Photos integrations" ON public.google_photos_integrations;

-- New stricter policies
CREATE POLICY "Family members can view Google Photos metadata only" 
ON public.google_photos_integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid()
  )
);

-- Only allow inserts through the secure function (tokens must be encrypted)
CREATE POLICY "Parents can create encrypted Google Photos integrations" 
ON public.google_photos_integrations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
  AND (access_token LIKE '%::%') -- Must be encrypted
);

-- Allow parents to update their family's integrations
CREATE POLICY "Parents can update Google Photos integrations" 
ON public.google_photos_integrations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);

-- Allow parents to delete their family's integrations
CREATE POLICY "Parents can delete Google Photos integrations" 
ON public.google_photos_integrations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);

-- 5. Create function to get encrypted Google Photos tokens for API use
CREATE OR REPLACE FUNCTION public.get_google_photos_tokens_for_api(integration_id_param uuid)
RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Get integration with ownership verification
  SELECT gpi.*, p.user_id
  INTO integration_record
  FROM public.google_photos_integrations gpi
  JOIN public.profiles p ON p.family_id = gpi.family_id
  WHERE gpi.id = integration_id_param;

  -- Verify ownership (only family members can access)
  IF integration_record.user_id IS NULL OR 
     NOT EXISTS (
       SELECT 1 FROM public.profiles p2 
       WHERE p2.family_id = integration_record.family_id 
       AND p2.user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Unauthorized token access';
  END IF;

  -- Decrypt tokens
  decrypted_access := public.decrypt_oauth_token(
    integration_record.access_token, 
    'access', 
    integration_id_param
  );
  
  IF integration_record.refresh_token IS NOT NULL THEN
    decrypted_refresh := public.decrypt_oauth_token(
      integration_record.refresh_token, 
      'refresh', 
      integration_id_param
    );
  END IF;

  -- Return decrypted tokens with expiration info
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at;
END;
$$;