-- Fix encryption/decryption for OAuth tokens with a stable key derivation approach
-- The previous implementation had a bug where the encryption key used NOW() timestamp
-- which made decryption impossible. This fixes that by using a stable key derivation.

-- Step 1: Create a new stable encryption function
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token_v2(
  token_value TEXT, 
  token_type TEXT DEFAULT 'access'
)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  encryption_key TEXT;
  encrypted_token BYTEA;
  salt TEXT;
  jwt_secret TEXT;
BEGIN
  -- Generate unique salt for this token
  salt := encode(gen_random_bytes(16), 'base64');
  
  -- Get the JWT secret for key derivation
  jwt_secret := coalesce(current_setting('app.settings.jwt_secret', true), 'fallback_encryption_key_2024');
  
  -- Create stable encryption key from salt and jwt_secret (NOT using timestamp)
  encryption_key := encode(
    digest(
      jwt_secret || salt || token_type,
      'sha256'
    ),
    'hex'
  );
  
  -- Encrypt using pgp_sym_encrypt for symmetric encryption
  encrypted_token := pgp_sym_encrypt(
    token_value,
    encryption_key,
    'cipher-algo=aes256'
  );
  
  -- Return format: salt::base64_encrypted_token (using :: as separator)
  RETURN salt || '::' || encode(encrypted_token, 'base64');
END;
$$;

-- Step 2: Create matching decryption function
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token_v2(
  encrypted_data TEXT, 
  token_type TEXT DEFAULT 'access'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  salt TEXT;
  encrypted_token TEXT;
  encryption_key TEXT;
  decrypted_token TEXT;
  parts TEXT[];
  jwt_secret TEXT;
BEGIN
  -- Handle null or empty input
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;

  -- Check if this is an encrypted token (contains ::)
  IF position('::' in encrypted_data) = 0 THEN
    -- Token is not encrypted (legacy), return as-is
    RETURN encrypted_data;
  END IF;

  -- Split salt and encrypted data using :: separator
  parts := string_to_array(encrypted_data, '::');
  IF array_length(parts, 1) != 2 THEN
    RETURN 'DECRYPTION_FAILED:Invalid token format';
  END IF;
  
  salt := parts[1];
  encrypted_token := parts[2];
  
  -- Get the JWT secret
  jwt_secret := coalesce(current_setting('app.settings.jwt_secret', true), 'fallback_encryption_key_2024');
  
  -- Recreate the same encryption key
  encryption_key := encode(
    digest(
      jwt_secret || salt || token_type,
      'sha256'
    ),
    'hex'
  );
  
  -- Decrypt the token
  BEGIN
    decrypted_token := pgp_sym_decrypt(
      decode(encrypted_token, 'base64'),
      encryption_key
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN 'DECRYPTION_FAILED:' || SQLERRM;
  END;
  
  RETURN decrypted_token;
END;
$$;

-- Step 3: Update the encrypt_oauth_token to use v2
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(
  token_value TEXT, 
  token_type TEXT DEFAULT 'access'
)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN public.encrypt_oauth_token_v2(token_value, token_type);
END;
$$;

-- Step 4: Update get_decrypted_calendar_tokens to actually decrypt
CREATE OR REPLACE FUNCTION public.get_decrypted_calendar_tokens(integration_id_param uuid)
RETURNS TABLE(
  access_token text, 
  refresh_token text, 
  expires_at timestamp with time zone, 
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
  user_profile_id UUID;
  user_role TEXT;
  user_family_id UUID;
  integration_family_id UUID;
BEGIN
  -- Get current user's profile info
  SELECT p.id, p.role, p.family_id 
  INTO user_profile_id, user_role, user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  -- Get integration record
  SELECT ci.*, p.user_id as owner_user_id, p.family_id as profile_family_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  IF integration_record IS NULL THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Verify access: must be the token owner OR a parent in the same family
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF integration_record.owner_user_id != auth.uid() THEN
    -- Not the owner, check if parent in same family
    IF user_role != 'parent' OR user_family_id != integration_record.profile_family_id THEN
      -- Log unauthorized attempt
      INSERT INTO public.calendar_token_audit (
        integration_id, user_id, action, success, error_message
      ) VALUES (
        integration_id_param, auth.uid(), 'unauthorized_decrypt_attempt', false, 'Insufficient permissions'
      );
      RAISE EXCEPTION 'Unauthorized token access';
    END IF;
  END IF;

  -- Decrypt access token
  decrypted_access := public.decrypt_oauth_token_v2(integration_record.access_token, 'access');
  
  -- Decrypt refresh token if present
  IF integration_record.refresh_token IS NOT NULL THEN
    decrypted_refresh := public.decrypt_oauth_token_v2(integration_record.refresh_token, 'refresh');
  END IF;

  -- Log successful decryption
  INSERT INTO public.calendar_token_audit (
    integration_id, user_id, action, success
  ) VALUES (
    integration_id_param, auth.uid(), 'decrypt_tokens', true
  );

  -- Return decrypted tokens
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;

-- Step 5: Update token update function to encrypt new tokens
CREATE OR REPLACE FUNCTION public.update_calendar_integration_tokens(
  integration_id_param UUID,
  new_access_token TEXT,
  new_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  integration_record RECORD;
  user_profile_id UUID;
  encrypted_access TEXT;
BEGIN
  -- Get user's profile
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  -- Get integration and verify ownership
  SELECT ci.*, p.user_id as owner_user_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  IF integration_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only the owner can update tokens
  IF integration_record.owner_user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;

  -- Encrypt the new access token
  encrypted_access := public.encrypt_oauth_token_v2(new_access_token, 'access');

  -- Update the integration
  UPDATE public.calendar_integrations
  SET 
    access_token = encrypted_access,
    expires_at = COALESCE(new_expires_at, expires_at),
    last_token_refresh = NOW(),
    token_refresh_count = COALESCE(token_refresh_count, 0) + 1,
    updated_at = NOW()
  WHERE id = integration_id_param;

  -- Log the refresh
  INSERT INTO public.calendar_token_audit (
    integration_id, user_id, action, success
  ) VALUES (
    integration_id_param, auth.uid(), 'token_refresh', true
  );

  RETURN TRUE;
END;
$$;