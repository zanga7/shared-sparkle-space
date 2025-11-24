-- Fix broken calendar token encryption/decryption system
-- The previous migration created an encryption function that uses one-way hashing (SHA256)
-- which cannot be decrypted. This fixes it with proper PGP symmetric encryption.

-- Drop broken functions
DROP FUNCTION IF EXISTS public.encrypt_oauth_token(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_oauth_token(text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_decrypted_calendar_tokens(uuid) CASCADE;

-- Get or create encryption key in oauth_secrets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.oauth_secrets WHERE key = 'CALENDAR_TOKEN_ENCRYPTION_KEY') THEN
    INSERT INTO public.oauth_secrets (key, value)
    VALUES (
      'CALENDAR_TOKEN_ENCRYPTION_KEY',
      encode(gen_random_bytes(32), 'hex')
    );
  END IF;
END $$;

-- Create proper encryption function using PGP
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value TEXT, token_type TEXT DEFAULT 'access')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  salt := encode(gen_random_bytes(16), 'hex');

  -- Encrypt using PGP with key + token_type + salt
  encrypted_data := encode(
    extensions.pgp_sym_encrypt(
      token_value::bytea,
      encryption_key || '_' || token_type || '_' || salt
    ),
    'base64'
  );

  -- Return format: encrypted_data::salt
  RETURN encrypted_data || '::' || salt;
END;
$$;

-- Create proper decryption function
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(
  encrypted_token TEXT,
  token_type TEXT DEFAULT 'access',
  integration_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
  salt_hex TEXT;
  encrypted_data_b64 TEXT;
  decrypted_value TEXT;
  parts TEXT[];
BEGIN
  -- Check for legacy format (no :: separator)
  IF encrypted_token IS NULL OR position('::' in encrypted_token) = 0 THEN
    -- Check if it looks like it might be a legacy encrypted token or plain token
    IF encrypted_token LIKE 'v2::%' OR encrypted_token LIKE 'DECRYPTION_FAILED:%' THEN
      RAISE EXCEPTION 'Legacy token format - please reconnect calendar';
    END IF;
    -- If it's something else, try to use it as-is (might be legacy plaintext)
    RAISE EXCEPTION 'Invalid token format - please reconnect calendar';
  END IF;

  -- Parse encrypted token format (encrypted_data::salt)
  parts := string_to_array(encrypted_token, '::');
  
  IF array_length(parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid encrypted token format - please reconnect calendar';
  END IF;

  encrypted_data_b64 := parts[1];
  salt_hex := parts[2];

  -- Get encryption key
  SELECT value INTO encryption_key
  FROM public.oauth_secrets
  WHERE key = 'CALENDAR_TOKEN_ENCRYPTION_KEY';

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Decrypt the token
  BEGIN
    decrypted_value := extensions.pgp_sym_decrypt(
      decode(encrypted_data_b64, 'base64'),
      encryption_key || '_' || token_type || '_' || salt_hex
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Token decryption failed - please reconnect calendar: %', SQLERRM;
  END;

  RETURN decrypted_value;
END;
$$;

-- Recreate get_decrypted_calendar_tokens with proper error handling
CREATE OR REPLACE FUNCTION public.get_decrypted_calendar_tokens(integration_id_param UUID)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Get integration with ownership verification
  SELECT ci.*, p.user_id, p.family_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Verify the user can access this integration
  IF NOT public.can_access_calendar_integration(integration_record.profile_id) THEN
    RAISE EXCEPTION 'Unauthorized access to calendar integration';
  END IF;

  -- Try to decrypt access token
  BEGIN
    decrypted_access := public.decrypt_oauth_token(
      integration_record.access_token,
      'access',
      integration_id_param
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Return error message that the edge function can detect
      decrypted_access := 'DECRYPTION_FAILED: ' || SQLERRM;
  END;

  -- Try to decrypt refresh token if present
  IF integration_record.refresh_token IS NOT NULL THEN
    BEGIN
      decrypted_refresh := public.decrypt_oauth_token(
        integration_record.refresh_token,
        'refresh',
        integration_id_param
      );
    EXCEPTION
      WHEN OTHERS THEN
        decrypted_refresh := 'DECRYPTION_FAILED: ' || SQLERRM;
    END;
  ELSE
    decrypted_refresh := NULL;
  END IF;

  -- Return decrypted tokens
  RETURN QUERY SELECT
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$$;