-- Enable pgcrypto extension for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add pin_type column to profiles to support numeric and icon PINs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_type text DEFAULT 'numeric' CHECK (pin_type IN ('numeric', 'icon'));

-- Update the set_child_pin function to handle both numeric and icon PINs
CREATE OR REPLACE FUNCTION public.set_child_pin(profile_id_param uuid, new_pin text, pin_type_param text DEFAULT 'numeric')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  pin_hash_result TEXT;
  user_family_id UUID;
  target_family_id UUID;
BEGIN
  -- Get current user's family
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF user_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can set PINs');
  END IF;

  -- Get target profile's family to verify access
  SELECT family_id INTO target_family_id
  FROM public.profiles
  WHERE id = profile_id_param;
  
  IF target_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  IF user_family_id != target_family_id THEN
    RETURN json_build_object('success', false, 'error', 'Access denied - different family');
  END IF;

  -- Validate PIN based on type
  IF pin_type_param = 'numeric' AND LENGTH(new_pin) < 4 THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be at least 4 digits');
  END IF;
  
  IF pin_type_param = 'icon' AND LENGTH(new_pin) < 4 THEN
    RETURN json_build_object('success', false, 'error', 'Icon PIN must have at least 4 icons');
  END IF;

  -- Hash the PIN using crypt with pgcrypto
  pin_hash_result := crypt(new_pin, gen_salt('bf', 8));
  
  -- Update the profile with the new PIN hash and type
  UPDATE public.profiles 
  SET 
    pin_hash = pin_hash_result,
    pin_type = pin_type_param,
    failed_pin_attempts = 0,
    pin_locked_until = NULL,
    updated_at = NOW()
  WHERE id = profile_id_param;

  -- Log the PIN setting action
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    'child_pin_set',
    'profiles',
    profile_id_param,
    NULL,
    json_build_object('pin_set_at', NOW(), 'set_by', auth.uid(), 'pin_type', pin_type_param)::jsonb
  );

  RETURN json_build_object('success', true, 'message', 'PIN set successfully');
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM public.create_audit_log(
      user_family_id,
      auth.uid(),
      'child_pin_set_failed',
      'profiles',
      profile_id_param,
      NULL,
      json_build_object('error', SQLERRM, 'failed_at', NOW())::jsonb
    );
    
    RETURN json_build_object('success', false, 'error', 'Failed to set PIN: ' || SQLERRM);
END;
$function$;