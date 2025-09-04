-- Security Fix: Database Function Hardening
-- Ensure all functions have proper search_path security settings

-- Update functions that may be missing search_path security settings
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value text, token_type text DEFAULT 'access'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
  encrypted_token TEXT;
  salt TEXT;
BEGIN
  -- Generate unique salt for this token
  salt := encode(gen_random_bytes(16), 'base64');
  
  -- Create encryption key from multiple sources for enhanced security
  encryption_key := encode(
    digest(
      current_setting('app.settings.jwt_secret', true) || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Encrypt using pgp_sym_encrypt with the derived key
  encrypted_token := encode(
    pgp_sym_encrypt(
      token_value,
      encryption_key,
      'cipher-algo=aes256, compress-algo=2'
    ),
    'base64'
  );
  
  -- Return salt + encrypted token for later decryption
  RETURN salt || '::' || encrypted_token;
EXCEPTION
  WHEN OTHERS THEN
    -- Log security event without exposing token
    PERFORM public.create_audit_log(
      NULL,
      auth.uid(),
      'token_encryption_failed',
      'calendar_integrations',
      NULL,
      NULL,
      json_build_object('error', 'Token encryption failed', 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token encryption failed';
END;
$function$;

-- Update decrypt function with enhanced security
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_data text, token_type text DEFAULT 'access'::text, requesting_integration_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  salt TEXT;
  encrypted_token TEXT;
  encryption_key TEXT;
  decrypted_token TEXT;
  parts TEXT[];
  integration_owner UUID;
BEGIN
  -- Verify access permissions if integration_id provided
  IF requesting_integration_id IS NOT NULL THEN
    SELECT p.user_id INTO integration_owner
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = requesting_integration_id;
    
    -- Only allow token owner or system functions to decrypt
    IF integration_owner IS NULL OR (auth.uid() IS NOT NULL AND integration_owner != auth.uid()) THEN
      -- Log unauthorized access attempt
      PERFORM public.create_audit_log(
        NULL,
        auth.uid(),
        'unauthorized_token_access',
        'calendar_integrations',
        requesting_integration_id,
        NULL,
        json_build_object('attempted_by', auth.uid(), 'token_type', token_type)
      );
      RAISE EXCEPTION 'Unauthorized token access';
    END IF;
  END IF;

  -- Split salt and encrypted data
  parts := string_to_array(encrypted_data, '::');
  IF array_length(parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid token format';
  END IF;
  
  salt := parts[1];
  encrypted_token := parts[2];
  
  -- Recreate encryption key
  encryption_key := encode(
    digest(
      current_setting('app.settings.jwt_secret', true) || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Decrypt token
  decrypted_token := pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
  
  -- Log successful decryption for audit
  PERFORM public.create_audit_log(
    NULL,
    auth.uid(),
    'token_decryption_success',
    'calendar_integrations',
    requesting_integration_id,
    NULL,
    json_build_object('token_type', token_type, 'timestamp', now())
  );
  
  RETURN decrypted_token;
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    PERFORM public.create_audit_log(
      NULL,
      auth.uid(),
      'token_decryption_failed',
      'calendar_integrations',
      requesting_integration_id,
      NULL,
      json_build_object('error', SQLERRM, 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token decryption failed';
END;
$function$;

-- Add enhanced security logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_risk_level text DEFAULT 'medium'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_family_id UUID;
  client_ip INET;
BEGIN
  -- Get current user's family ID
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Get client IP if available
  client_ip := inet_client_addr();

  -- Create detailed security audit log
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    p_event_type,
    COALESCE(p_entity_type, 'security_event'),
    p_entity_id,
    NULL,
    json_build_object(
      'risk_level', p_risk_level,
      'timestamp', NOW(),
      'ip_address', client_ip::text,
      'user_agent', current_setting('request.headers', true)::json->>'user-agent',
      'details', p_details
    )
  );
END;
$function$;

-- Add PIN attempt logging function
CREATE OR REPLACE FUNCTION public.log_pin_attempt(
  p_profile_id uuid,
  p_success boolean,
  p_attempt_type text DEFAULT 'authentication'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_family_id UUID;
BEGIN
  -- Get profile's family ID
  SELECT family_id INTO profile_family_id
  FROM public.profiles 
  WHERE id = p_profile_id;

  -- Log the PIN attempt
  PERFORM public.log_security_event(
    'pin_attempt',
    'profiles',
    p_profile_id,
    json_build_object(
      'success', p_success,
      'attempt_type', p_attempt_type,
      'profile_id', p_profile_id
    ),
    CASE WHEN p_success THEN 'low' ELSE 'high' END
  );

  -- If failed attempt, increment counter and check lockout
  IF NOT p_success THEN
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = failed_pin_attempts + 1,
      pin_locked_until = CASE 
        WHEN failed_pin_attempts + 1 >= (
          SELECT pin_attempts_limit 
          FROM public.household_settings 
          WHERE family_id = profile_family_id
        ) THEN 
          NOW() + (
            SELECT pin_lockout_duration || ' seconds'
            FROM public.household_settings 
            WHERE family_id = profile_family_id
          )::INTERVAL
        ELSE pin_locked_until
      END
    WHERE id = p_profile_id;
  ELSE
    -- Reset failed attempts on successful login
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = 0,
      pin_locked_until = NULL
    WHERE id = p_profile_id;
  END IF;
END;
$function$;

-- Add admin action logging
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_entity text,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user is parent/admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  ) THEN
    RAISE EXCEPTION 'Unauthorized admin action attempt';
  END IF;

  -- Log the admin action
  PERFORM public.log_security_event(
    'admin_action_' || p_action,
    p_target_entity,
    p_target_id,
    json_build_object(
      'action', p_action,
      'target_entity', p_target_entity,
      'admin_details', p_details
    ),
    'medium'
  );
END;
$function$;

-- Update authenticate_member_pin_dashboard to include security logging
CREATE OR REPLACE FUNCTION public.authenticate_member_pin_dashboard(
  profile_id_param uuid,
  pin_param text,
  pin_type_param text DEFAULT 'numeric',
  device_id_param text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stored_pin_hash TEXT;
  is_locked BOOLEAN := false;
  lockout_until TIMESTAMP WITH TIME ZONE;
  pin_cache_duration INTERVAL := '15 minutes';
  actual_device_id TEXT;
BEGIN
  -- Use provided device_id or derive from headers
  actual_device_id := COALESCE(
    device_id_param, 
    current_setting('request.headers', true)::json->>'user-agent',
    'unknown'
  );

  -- Check if profile is locked due to failed attempts
  SELECT pin_locked_until INTO lockout_until
  FROM public.profiles 
  WHERE id = profile_id_param;
  
  is_locked := (lockout_until IS NOT NULL AND lockout_until > NOW());
  
  IF is_locked THEN
    -- Log failed attempt due to lockout
    PERFORM public.log_pin_attempt(profile_id_param, false, 'locked_account');
    RETURN json_build_object(
      'success', false, 
      'error', 'Account temporarily locked due to too many failed attempts',
      'locked_until', lockout_until
    );
  END IF;

  -- Get stored PIN hash
  SELECT pin_hash INTO stored_pin_hash
  FROM public.profiles 
  WHERE id = profile_id_param;
  
  IF stored_pin_hash IS NULL THEN
    PERFORM public.log_pin_attempt(profile_id_param, false, 'no_pin_set');
    RETURN json_build_object('success', false, 'error', 'No PIN set for this profile');
  END IF;
  
  -- Verify PIN
  IF crypt(pin_param, stored_pin_hash) = stored_pin_hash THEN
    -- Log successful authentication
    PERFORM public.log_pin_attempt(profile_id_param, true, 'dashboard_login');
    
    -- Update or create dashboard session with PIN cache
    INSERT INTO public.dashboard_sessions (
      device_id, 
      active_member_id, 
      pin_cache_expires
    ) VALUES (
      actual_device_id, 
      profile_id_param, 
      NOW() + pin_cache_duration
    )
    ON CONFLICT (device_id) DO UPDATE SET
      active_member_id = profile_id_param,
      pin_cache_expires = NOW() + pin_cache_duration,
      last_activity = NOW();
    
    RETURN json_build_object('success', true, 'message', 'PIN authenticated successfully');
  ELSE
    -- Log failed authentication
    PERFORM public.log_pin_attempt(profile_id_param, false, 'wrong_pin');
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;
END;
$function$;