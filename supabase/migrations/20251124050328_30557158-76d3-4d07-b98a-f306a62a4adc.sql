-- Fix encryption key configuration for OAuth token encryption
-- This migration creates a secure encryption key and updates the encryption functions

-- ============================================================================
-- Step 1: Create encryption key if it doesn't exist
-- ============================================================================

DO $$
DECLARE
  key_exists BOOLEAN;
BEGIN
  -- Check if encryption key already exists
  SELECT EXISTS (
    SELECT 1 FROM oauth_secrets WHERE key = 'oauth_encryption_key'
  ) INTO key_exists;
  
  -- Only create if it doesn't exist
  IF NOT key_exists THEN
    INSERT INTO oauth_secrets (key, value)
    VALUES (
      'oauth_encryption_key',
      encode(extensions.gen_random_bytes(32), 'hex')
    );
    RAISE NOTICE 'OAuth encryption key created successfully';
  ELSE
    RAISE NOTICE 'OAuth encryption key already exists, skipping creation';
  END IF;
END $$;

-- ============================================================================
-- Step 2: Create helper function to get encryption key securely
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_oauth_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Retrieve the encryption key from oauth_secrets
  SELECT value INTO encryption_key
  FROM oauth_secrets
  WHERE key = 'oauth_encryption_key';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'OAuth encryption key not configured. Please run migration to initialize.';
  END IF;
  
  RETURN encryption_key;
END;
$$;

-- ============================================================================
-- Step 3: Update encrypt_oauth_token to use the stored key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value TEXT, token_type TEXT DEFAULT 'access')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
  salt BYTEA;
  encrypted_data TEXT;
BEGIN
  -- Validate input
  IF token_value IS NULL OR length(token_value) < 10 THEN
    RAISE EXCEPTION 'Invalid token value provided';
  END IF;

  -- Get encryption key from oauth_secrets table
  encryption_key := public.get_oauth_encryption_key();

  -- Generate a unique salt for this token
  salt := extensions.gen_random_bytes(16);
  
  -- Encrypt using AES with salt and token type for additional security
  encrypted_data := encode(
    extensions.pgp_sym_encrypt(
      token_value,
      encryption_key || '_' || token_type || '_' || encode(salt, 'hex')
    ),
    'base64'
  );

  -- Return format: encrypted_data::salt (for decryption)
  RETURN encrypted_data || '::' || encode(salt, 'hex');
END;
$$;

-- ============================================================================
-- Step 4: Update decrypt_oauth_token to use the stored key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_token TEXT, integration_id UUID, token_type TEXT DEFAULT 'access')
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
  -- Validate access permission
  IF NOT public.can_access_calendar_integration(
    (SELECT profile_id FROM public.calendar_integrations WHERE id = integration_id)
  ) THEN
    RAISE EXCEPTION 'Access denied to calendar integration';
  END IF;

  -- Rate limiting check
  IF NOT public.check_token_access_rate_limit(integration_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for token access';
  END IF;

  -- Parse encrypted token format (encrypted_data::salt)
  parts := string_to_array(encrypted_token, '::');
  
  IF array_length(parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid encrypted token format';
  END IF;

  encrypted_data_b64 := parts[1];
  salt_hex := parts[2];

  -- Get encryption key from oauth_secrets table
  encryption_key := public.get_oauth_encryption_key();

  -- Decrypt the token
  BEGIN
    decrypted_value := extensions.pgp_sym_decrypt(
      decode(encrypted_data_b64, 'base64'),
      encryption_key || '_' || token_type || '_' || salt_hex
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log decryption failure
      PERFORM public.log_sensitive_access(
        'calendar_integrations',
        integration_id,
        'token_decryption_failed',
        false,
        json_build_object('error', SQLERRM)
      );
      RAISE EXCEPTION 'Token decryption failed: %', SQLERRM;
  END;

  -- Log successful token access
  PERFORM public.log_sensitive_access(
    'calendar_integrations',
    integration_id,
    'token_decrypted',
    true,
    json_build_object('token_type', token_type)
  );

  RETURN decrypted_value;
END;
$$;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'OAuth encryption key configuration completed successfully';
  RAISE NOTICE 'Encryption functions updated to use stored encryption key';
END $$;