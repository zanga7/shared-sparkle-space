-- Phase 1: Fix encrypt_oauth_token to add v2:: prefix
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value text, token_type text DEFAULT 'access'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
  salt TEXT;
  encrypted_data TEXT;
BEGIN
  IF token_value IS NULL OR token_value = '' THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from secrets
  SELECT value INTO encryption_key
  FROM public.oauth_secrets
  WHERE key = 'CALENDAR_TOKEN_ENCRYPTION_KEY';

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Generate random salt
  salt := encode(extensions.gen_random_bytes(16), 'hex');

  -- Encrypt using PGP with key + token_type + salt
  encrypted_data := encode(
    extensions.pgp_sym_encrypt(
      token_value,
      encryption_key || '_' || token_type || '_' || salt
    ),
    'base64'
  );

  -- Return v2 format: v2::encrypted_data::salt
  RETURN 'v2::' || encrypted_data || '::' || salt;
END;
$function$;

-- Phase 1: Update decrypt_oauth_token to handle v2:: prefix
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_token text, token_type text DEFAULT 'access'::text, integration_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
  salt TEXT;
  encrypted_data TEXT;
  decrypted_value TEXT;
  token_version TEXT := 'v1';
BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;

  -- Handle revoked tokens
  IF encrypted_token = 'REVOKED' OR encrypted_token = 'PENDING_ENCRYPTION' THEN
    RETURN NULL;
  END IF;

  -- Check for v2 format and extract version
  IF encrypted_token LIKE 'v2::%' THEN
    token_version := 'v2';
    -- Remove v2:: prefix
    encrypted_token := substring(encrypted_token from 5);
  END IF;

  -- Split encrypted token into data and salt
  encrypted_data := split_part(encrypted_token, '::', 1);
  salt := split_part(encrypted_token, '::', 2);

  IF encrypted_data IS NULL OR salt IS NULL OR encrypted_data = '' OR salt = '' THEN
    RAISE EXCEPTION 'Invalid token format';
  END IF;

  -- Get encryption key
  SELECT value INTO encryption_key
  FROM public.oauth_secrets
  WHERE key = 'CALENDAR_TOKEN_ENCRYPTION_KEY';

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Decrypt using the same key derivation
  decrypted_value := extensions.pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key || '_' || token_type || '_' || salt
  );

  -- Log token access for audit trail
  IF integration_id IS NOT NULL THEN
    INSERT INTO public.calendar_token_audit (
      integration_id,
      user_id,
      action,
      success,
      ip_address
    ) VALUES (
      integration_id,
      auth.uid(),
      'decrypt_' || token_type,
      true,
      inet_client_addr()
    );
  END IF;

  RETURN decrypted_value;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failed decryption
    IF integration_id IS NOT NULL THEN
      INSERT INTO public.calendar_token_audit (
        integration_id,
        user_id,
        action,
        success,
        error_message,
        ip_address
      ) VALUES (
        integration_id,
        auth.uid(),
        'decrypt_' || token_type || '_failed',
        false,
        SQLERRM,
        inet_client_addr()
      );
    END IF;
    RAISE;
END;
$function$;

-- Phase 2: Migrate existing tokens to v2 format
CREATE OR REPLACE FUNCTION public.migrate_tokens_to_v2_format()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER := 0;
  integration_record RECORD;
BEGIN
  -- Only parents can run this migration
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can run token migration');
  END IF;

  -- Update tokens that don't have v2:: prefix but have the correct format
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.calendar_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE 'v2::%'
    AND access_token LIKE '%::%'  -- Has the encrypted_data::salt format
    AND access_token != 'REVOKED'
    AND access_token != 'PENDING_ENCRYPTION'
  LOOP
    BEGIN
      -- Add v2:: prefix to existing tokens
      UPDATE public.calendar_integrations 
      SET 
        access_token = 'v2::' || access_token,
        refresh_token = CASE 
          WHEN refresh_token IS NOT NULL AND refresh_token LIKE '%::%' 
          THEN 'v2::' || refresh_token
          ELSE refresh_token
        END,
        security_flags = COALESCE(security_flags, '{}'::jsonb) || 
          json_build_object(
            'migrated_to_v2', true,
            'migration_timestamp', NOW(),
            'encryption_version', '2.0'
          )::jsonb,
        updated_at = NOW()
      WHERE id = integration_record.id;

      updated_count := updated_count + 1;

      -- Log the migration
      PERFORM public.log_sensitive_access(
        'calendar_integrations',
        integration_record.id,
        'token_migrated_to_v2',
        true,
        json_build_object('migrated_at', NOW())
      );

    EXCEPTION
      WHEN OTHERS THEN
        -- Log migration failure but continue
        PERFORM public.log_sensitive_access(
          'calendar_integrations',
          integration_record.id,
          'token_migration_v2_failed',
          false,
          json_build_object('error', SQLERRM)
        );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'migrated_count', updated_count,
    'message', 'Tokens migrated to v2 format'
  );
END;
$function$;

-- Phase 3: Drop and recreate get_calendar_integrations_metadata with correct signature
DROP FUNCTION IF EXISTS public.get_calendar_integrations_metadata();

CREATE FUNCTION public.get_calendar_integrations_metadata()
 RETURNS TABLE(
   id uuid,
   profile_id uuid,
   integration_type text,
   calendar_id text,
   is_active boolean,
   created_at timestamptz,
   updated_at timestamptz,
   expires_at timestamptz,
   is_expired boolean,
   is_encrypted boolean,
   has_access_token boolean,
   has_refresh_token boolean,
   last_token_refresh timestamptz,
   token_refresh_count integer
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family
  SELECT p.family_id INTO user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF user_family_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Return calendar integrations metadata for the family
  RETURN QUERY
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_expired,
    (ci.access_token LIKE 'v2::%') as is_encrypted,  -- v2:: prefix indicates proper encryption
    (ci.access_token IS NOT NULL AND ci.access_token != 'REVOKED') as has_access_token,
    (ci.refresh_token IS NOT NULL AND ci.refresh_token != 'REVOKED') as has_refresh_token,
    ci.last_token_refresh,
    ci.token_refresh_count
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  ORDER BY ci.created_at DESC;
END;
$function$;