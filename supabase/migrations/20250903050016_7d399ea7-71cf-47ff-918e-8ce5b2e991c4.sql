-- Ensure pgcrypto extension is available in the correct schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Drop and recreate the function with correct extension usage
DROP FUNCTION IF EXISTS public.set_child_pin(uuid, text, text);

-- Create function to set child PIN with proper hashing
CREATE OR REPLACE FUNCTION public.set_child_pin(
  profile_id_param UUID,
  pin_param TEXT,
  pin_type_param TEXT DEFAULT 'numeric'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  family_id_val UUID;
  current_user_profile_id UUID;
  pin_hash_val TEXT;
BEGIN
  -- Get current user's profile and family
  SELECT p.id, p.family_id INTO current_user_profile_id, family_id_val
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF current_user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Verify the target profile exists and is in the same family
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = profile_id_param AND family_id = family_id_val
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Target profile not found or access denied');
  END IF;
  
  -- Hash the PIN using pgcrypto extension
  pin_hash_val := extensions.crypt(pin_param, extensions.gen_salt('bf'));
  
  -- Update the profile with the new PIN
  UPDATE public.profiles 
  SET 
    pin_hash = pin_hash_val,
    pin_type = pin_type_param,
    failed_pin_attempts = 0,
    pin_locked_until = NULL,
    updated_at = NOW()
  WHERE id = profile_id_param;
  
  -- Create audit log
  PERFORM public.create_audit_log(
    family_id_val,
    auth.uid(),
    'pin_set',
    'profiles',
    profile_id_param,
    NULL,
    json_build_object('pin_type', pin_type_param, 'set_at', NOW())
  );
  
  RETURN json_build_object('success', true, 'message', 'PIN set successfully');
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;