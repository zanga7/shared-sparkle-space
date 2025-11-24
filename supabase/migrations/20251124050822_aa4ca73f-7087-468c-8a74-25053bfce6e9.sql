-- Add helper functions to detect and handle legacy calendar tokens
-- This helps users migrate from old encryption to new encryption

-- ============================================================================
-- Function to detect if a token is in legacy format
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_legacy_calendar_token(token_value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Legacy tokens don't have the '::' separator that new encrypted tokens have
  RETURN token_value IS NOT NULL 
    AND token_value != 'REVOKED' 
    AND token_value != 'PENDING_ENCRYPTION'
    AND position('::' in token_value) = 0;
END;
$$;

-- ============================================================================
-- Function to get calendar integration status with encryption info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_calendar_integration_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  user_family_id UUID;
  total_integrations INTEGER;
  legacy_integrations INTEGER;
  encrypted_integrations INTEGER;
BEGIN
  -- Get current user's profile
  SELECT p.id, p.family_id INTO user_profile_id, user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;

  -- Count total integrations for this family
  SELECT COUNT(*) INTO total_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;

  -- Count legacy (old encryption) integrations
  SELECT COUNT(*) INTO legacy_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  AND public.is_legacy_calendar_token(ci.access_token);

  -- Count properly encrypted integrations
  SELECT COUNT(*) INTO encrypted_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  AND NOT public.is_legacy_calendar_token(ci.access_token)
  AND ci.access_token != 'REVOKED';

  RETURN json_build_object(
    'total_integrations', total_integrations,
    'legacy_integrations', legacy_integrations,
    'encrypted_integrations', encrypted_integrations,
    'needs_migration', legacy_integrations > 0,
    'encryption_complete', legacy_integrations = 0 AND total_integrations > 0
  );
END;
$$;

-- ============================================================================
-- Function to safely remove legacy calendar integrations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_legacy_calendar_integrations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  user_family_id UUID;
  deleted_count INTEGER := 0;
BEGIN
  -- Get current user's profile (must be parent)
  SELECT p.id, p.family_id INTO user_profile_id, user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'parent';
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can remove integrations');
  END IF;

  -- Delete legacy integrations for this family
  WITH deleted AS (
    DELETE FROM public.calendar_integrations ci
    USING public.profiles p
    WHERE ci.profile_id = p.id
    AND p.family_id = user_family_id
    AND public.is_legacy_calendar_token(ci.access_token)
    RETURNING ci.id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Log the cleanup
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    'legacy_calendar_integrations_removed',
    'calendar_integrations',
    NULL,
    NULL,
    json_build_object(
      'deleted_count', deleted_count,
      'cleanup_reason', 'encryption_upgrade',
      'cleaned_at', NOW()
    )
  );

  RETURN json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'message', 'Legacy integrations removed. Please reconnect your calendars.'
  );
END;
$$;

-- ============================================================================
-- Update decrypt function to provide clearer error for legacy tokens
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

  -- Check if this is a legacy token (no :: separator)
  IF public.is_legacy_calendar_token(encrypted_token) THEN
    -- Log the legacy token detection
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id,
      'legacy_token_detected',
      false,
      json_build_object('token_type', token_type, 'reason', 'old_encryption_format')
    );
    RAISE EXCEPTION 'DECRYPTION_FAILED: Legacy token format - please reconnect calendar';
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
  RAISE NOTICE 'Legacy token detection and cleanup functions created successfully';
  RAISE NOTICE 'Users can now safely remove and reconnect legacy calendar integrations';
END $$;