-- Fix remaining function search path security warnings

-- Find and fix functions without proper search_path settings
-- These are likely the remaining functions that need the security definer search path

CREATE OR REPLACE FUNCTION public.create_missing_profile_for_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_profile_count INTEGER;
  new_family_id UUID;
  user_email TEXT;
  display_name TEXT;
BEGIN
  -- Check if user already has a profile
  SELECT COUNT(*) INTO existing_profile_count
  FROM public.profiles 
  WHERE user_id = target_user_id;
  
  IF existing_profile_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Profile already exists');
  END IF;

  -- Get user email from auth.users if possible
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = target_user_id;
  
  -- Create display name from email
  display_name := COALESCE(split_part(user_email, '@', 1), 'User');
  
  -- Create a new family for this user
  INSERT INTO public.families (name) 
  VALUES (display_name || '''s Family')
  RETURNING id INTO new_family_id;
  
  -- Create the profile
  INSERT INTO public.profiles (
    user_id, 
    family_id, 
    display_name, 
    role
  ) VALUES (
    target_user_id,
    new_family_id,
    display_name,
    'parent'::public.user_role
  );
  
  RETURN json_build_object('success', true, 'message', 'Profile created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update any other functions that might be missing search_path
CREATE OR REPLACE FUNCTION public.authenticate_child_pin(
  profile_id_param uuid,
  pin_attempt text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Verify PIN
  stored_pin_hash := member_record.pin_hash;
  
  IF stored_pin_hash = crypt(pin_attempt, stored_pin_hash) THEN
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

CREATE OR REPLACE FUNCTION public.set_child_pin(
  profile_id_param uuid,
  new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  family_id_val UUID;
  target_profile RECORD;
BEGIN
  -- Validate PIN format
  IF NOT (new_pin ~ '^[0-9]{4}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  
  -- Get current user's family
  SELECT family_id INTO family_id_val
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF family_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Get target profile and verify family access
  SELECT * INTO target_profile
  FROM public.profiles
  WHERE id = profile_id_param AND family_id = family_id_val;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found or access denied');
  END IF;
  
  -- Update PIN with secure hash
  UPDATE public.profiles 
  SET 
    pin_hash = crypt(new_pin, gen_salt('bf')),
    failed_pin_attempts = 0,
    pin_locked_until = NULL,
    updated_at = now()
  WHERE id = profile_id_param;
  
  RETURN json_build_object('success', true, 'message', 'PIN set successfully');
END;
$$;