-- Comprehensive fix for pgcrypto function calls in SECURITY DEFINER functions
-- This migration adds the extensions. schema prefix to all pgcrypto function calls
-- to fix the "function does not exist" errors when search_path is set to public

-- ============================================================================
-- Phase 1: Fix Token Encryption Functions (Critical - Fixes Current Error)
-- ============================================================================

-- Update encrypt_oauth_token to use extensions.gen_random_bytes and extensions.pgp_sym_encrypt
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

  -- Get encryption key from environment (project-specific)
  encryption_key := current_setting('app.settings.jwt_secret', true);
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  -- Generate a unique salt for this token using extensions schema
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

-- Update decrypt_oauth_token to use extensions.pgp_sym_decrypt
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

  -- Get encryption key
  encryption_key := current_setting('app.settings.jwt_secret', true);
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;

  -- Decrypt the token using extensions schema
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
      RAISE EXCEPTION 'Token decryption failed';
  END;

  -- Log successful token access (without exposing token value)
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
-- Phase 2: Fix PIN Authentication Functions (Preventive)
-- ============================================================================

-- Update authenticate_child_pin to use extensions.crypt
CREATE OR REPLACE FUNCTION public.authenticate_child_pin(profile_id_param UUID, pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin_hash TEXT;
  member_record RECORD;
  family_id_val UUID;
BEGIN
  -- Get member details and verify family access
  SELECT p.*, p.family_id INTO member_record
  FROM public.profiles p
  WHERE p.id = profile_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  -- Get current user's family to verify access
  SELECT family_id INTO family_id_val
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF member_record.family_id != family_id_val THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Check if PIN is required
  IF member_record.pin_hash IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'No PIN required');
  END IF;
  
  -- Check lockout status
  IF member_record.pin_locked_until IS NOT NULL AND member_record.pin_locked_until > now() THEN
    RETURN json_build_object('success', false, 'error', 'Account temporarily locked');
  END IF;
  
  -- Verify PIN using extensions.crypt
  stored_pin_hash := member_record.pin_hash;
  
  IF stored_pin_hash = extensions.crypt(pin_attempt, stored_pin_hash) THEN
    -- Success: reset failed attempts
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = 0,
      pin_locked_until = NULL
    WHERE id = profile_id_param;
    
    RETURN json_build_object('success', true, 'message', 'PIN verified');
  ELSE
    -- Failed PIN: increment attempts
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = failed_pin_attempts + 1,
      pin_locked_until = CASE 
        WHEN failed_pin_attempts + 1 >= 3 THEN now() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE id = profile_id_param;
    
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;
END;
$$;

-- Update authenticate_member_pin_dashboard (first version) to use extensions.crypt
CREATE OR REPLACE FUNCTION public.authenticate_member_pin_dashboard(profile_id_param UUID, pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin_hash TEXT;
  member_record RECORD;
  family_id_val UUID;
BEGIN
  -- Get member details and verify family access
  SELECT p.*, p.family_id INTO member_record
  FROM public.profiles p
  WHERE p.id = profile_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  -- Verify family access
  family_id_val := public.get_current_user_family_id();
  IF member_record.family_id != family_id_val THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Check if PIN is required
  IF member_record.pin_hash IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'No PIN required');
  END IF;
  
  -- Check lockout status
  IF member_record.pin_locked_until IS NOT NULL AND member_record.pin_locked_until > now() THEN
    RETURN json_build_object('success', false, 'error', 'Account temporarily locked');
  END IF;
  
  -- Verify PIN using extensions.crypt
  stored_pin_hash := member_record.pin_hash;
  
  IF stored_pin_hash = extensions.crypt(pin_attempt, stored_pin_hash) THEN
    -- Success: reset failed attempts and update cache
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = 0,
      pin_locked_until = NULL
    WHERE id = profile_id_param;
    
    -- Update or create dashboard session with PIN cache
    INSERT INTO public.dashboard_sessions (device_id, active_member_id, pin_cache_expires)
    VALUES (
      COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown'),
      profile_id_param,
      now() + INTERVAL '5 minutes'
    )
    ON CONFLICT (device_id) DO UPDATE SET
      active_member_id = profile_id_param,
      pin_cache_expires = now() + INTERVAL '5 minutes',
      last_activity = now(),
      updated_at = now();
    
    RETURN json_build_object('success', true, 'message', 'PIN verified');
  ELSE
    -- Failed PIN: increment attempts
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = failed_pin_attempts + 1,
      pin_locked_until = CASE 
        WHEN failed_pin_attempts + 1 >= 3 THEN now() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE id = profile_id_param;
    
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;
END;
$$;

-- Update hash_pin helper function to use extensions.crypt and extensions.gen_salt
CREATE OR REPLACE FUNCTION public.hash_pin(pin_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN extensions.crypt(pin_text, extensions.gen_salt('bf', 10));
END;
$$;

-- Update verify_pin helper function to use extensions.crypt
CREATE OR REPLACE FUNCTION public.verify_pin(pin_text TEXT, pin_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pin_hash = extensions.crypt(pin_text, pin_hash);
END;
$$;

-- ============================================================================
-- Phase 3: Add Audit Log for Migration Success
-- ============================================================================

-- Log that this critical security fix has been applied
DO $$
BEGIN
  RAISE NOTICE 'pgcrypto schema qualification migration completed successfully';
  RAISE NOTICE 'All SECURITY DEFINER functions now use extensions.* prefix for pgcrypto calls';
END $$;