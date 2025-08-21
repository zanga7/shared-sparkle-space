-- Add proper RLS policies to calendar_security_summary table
ALTER TABLE public.calendar_security_summary ENABLE ROW LEVEL SECURITY;

-- Only parents can view calendar security summary for their family
CREATE POLICY "Parents can view calendar security summary" 
ON public.calendar_security_summary 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    JOIN public.profiles current_p ON current_p.family_id = p.family_id
    WHERE ci.id = calendar_security_summary.id
    AND current_p.user_id = auth.uid()
    AND current_p.role = 'parent'
  )
);

-- Create a function to securely hash PINs using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash PIN using bcrypt
CREATE OR REPLACE FUNCTION public.hash_pin(pin_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(pin_text, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify PIN
CREATE OR REPLACE FUNCTION public.verify_pin(pin_text TEXT, pin_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pin_hash = crypt(pin_text, pin_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure PIN validation function for child authentication
CREATE OR REPLACE FUNCTION public.authenticate_child_pin(
  profile_id_param UUID,
  pin_attempt TEXT
)
RETURNS JSON AS $$
DECLARE
  profile_record RECORD;
  new_failed_attempts INTEGER;
  max_attempts INTEGER := 3;
  lockout_duration INTEGER := 300; -- 5 minutes
  result JSON;
BEGIN
  -- Get profile and household settings
  SELECT p.*, hs.pin_attempts_limit, hs.pin_lockout_duration
  INTO profile_record
  FROM public.profiles p
  LEFT JOIN public.household_settings hs ON hs.family_id = p.family_id
  WHERE p.id = profile_id_param 
  AND p.user_id IS NULL 
  AND p.status = 'active';

  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Use household settings or defaults
  max_attempts := COALESCE(profile_record.pin_attempts_limit, 3);
  lockout_duration := COALESCE(profile_record.pin_lockout_duration, 300);

  -- Check if profile is locked
  IF profile_record.pin_locked_until IS NOT NULL AND 
     profile_record.pin_locked_until > NOW() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Account locked. Try again later.',
      'locked_until', profile_record.pin_locked_until
    );
  END IF;

  -- Check if PIN hash exists
  IF profile_record.pin_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PIN not set for this profile');
  END IF;

  -- Verify PIN using secure hash comparison
  IF public.verify_pin(pin_attempt, profile_record.pin_hash) THEN
    -- Reset failed attempts on successful login
    UPDATE public.profiles 
    SET failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = NOW()
    WHERE id = profile_id_param;

    -- Log successful authentication
    PERFORM public.create_audit_log(
      profile_record.family_id,
      profile_record.id,
      'child_pin_auth_success',
      'profiles',
      profile_record.id,
      NULL,
      json_build_object('authenticated_at', NOW())
    );

    RETURN json_build_object('success', true, 'profile_id', profile_id_param);
  ELSE
    -- Increment failed attempts
    new_failed_attempts := COALESCE(profile_record.failed_pin_attempts, 0) + 1;
    
    -- Check if account should be locked
    IF new_failed_attempts >= max_attempts THEN
      UPDATE public.profiles 
      SET 
        failed_pin_attempts = new_failed_attempts,
        pin_locked_until = NOW() + (lockout_duration || ' seconds')::INTERVAL,
        updated_at = NOW()
      WHERE id = profile_id_param;

      -- Log account lockout
      PERFORM public.create_audit_log(
        profile_record.family_id,
        profile_record.id,
        'child_pin_lockout',
        'profiles',
        profile_record.id,
        NULL,
        json_build_object('failed_attempts', new_failed_attempts, 'locked_until', NOW() + (lockout_duration || ' seconds')::INTERVAL)
      );

      RETURN json_build_object(
        'success', false, 
        'error', 'Account locked due to too many failed attempts',
        'locked_until', NOW() + (lockout_duration || ' seconds')::INTERVAL
      );
    ELSE
      UPDATE public.profiles 
      SET failed_pin_attempts = new_failed_attempts, updated_at = NOW()
      WHERE id = profile_id_param;

      -- Log failed attempt
      PERFORM public.create_audit_log(
        profile_record.family_id,
        profile_record.id,
        'child_pin_auth_failed',
        'profiles',
        profile_record.id,
        NULL,
        json_build_object('failed_attempts', new_failed_attempts)
      );

      RETURN json_build_object(
        'success', false, 
        'error', 'Invalid PIN. Please try again.',
        'attempts_remaining', max_attempts - new_failed_attempts
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to securely set PIN for child profile (parent only)
CREATE OR REPLACE FUNCTION public.set_child_pin(
  profile_id_param UUID,
  new_pin TEXT
)
RETURNS JSON AS $$
DECLARE
  profile_record RECORD;
  calling_user_profile RECORD;
  hashed_pin TEXT;
BEGIN
  -- Get calling user's profile
  SELECT * INTO calling_user_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF NOT FOUND OR calling_user_profile.role != 'parent' THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can set child PINs');
  END IF;

  -- Get target profile
  SELECT * INTO profile_record
  FROM public.profiles 
  WHERE id = profile_id_param 
  AND family_id = calling_user_profile.family_id
  AND user_id IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Child profile not found');
  END IF;

  -- Validate PIN (4 digits)
  IF new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Hash the PIN
  hashed_pin := public.hash_pin(new_pin);

  -- Update profile with hashed PIN
  UPDATE public.profiles 
  SET 
    pin_hash = hashed_pin,
    failed_pin_attempts = 0,
    pin_locked_until = NULL,
    updated_at = NOW()
  WHERE id = profile_id_param;

  -- Log PIN change
  PERFORM public.create_audit_log(
    profile_record.family_id,
    calling_user_profile.id,
    'child_pin_set',
    'profiles',
    profile_record.id,
    NULL,
    json_build_object('set_by', calling_user_profile.id, 'set_at', NOW())
  );

  RETURN json_build_object('success', true, 'message', 'PIN set successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;