-- Fix the authenticate_member_pin_dashboard function to use extensions.crypt
CREATE OR REPLACE FUNCTION public.authenticate_member_pin_dashboard(profile_id_param uuid, pin_attempt text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  family_id_val := get_current_user_family_id();
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
$function$;