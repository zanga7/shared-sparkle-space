-- Fix the set_child_pin function to use proper salt generation
CREATE OR REPLACE FUNCTION public.set_child_pin(profile_id_param uuid, new_pin text, pin_type_param text DEFAULT 'numeric'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_family_id UUID;
  target_family_id UUID;
  hashed_pin TEXT;
BEGIN
  -- Get current user's family ID
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF user_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can set PINs');
  END IF;
  
  -- Get target profile's family ID
  SELECT family_id INTO target_family_id
  FROM public.profiles 
  WHERE id = profile_id_param;
  
  IF target_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Verify family access
  IF user_family_id != target_family_id THEN
    RETURN json_build_object('success', false, 'error', 'Access denied - different family');
  END IF;
  
  -- Hash the PIN using crypt with blowfish salt (correct syntax)
  hashed_pin := crypt(new_pin, gen_salt('bf'));
  
  -- Update the profile with new PIN
  UPDATE public.profiles 
  SET 
    pin_hash = hashed_pin,
    pin_type = pin_type_param,
    failed_pin_attempts = 0,
    pin_locked_until = NULL,
    updated_at = NOW()
  WHERE id = profile_id_param;
  
  RETURN json_build_object('success', true, 'message', 'PIN set successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;