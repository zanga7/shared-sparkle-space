-- Update the update_reward function to properly handle the reward_type enum
CREATE OR REPLACE FUNCTION public.update_reward(
  reward_id_param uuid, 
  title_param text, 
  description_param text DEFAULT NULL::text, 
  cost_points_param integer DEFAULT 10, 
  reward_type_param text DEFAULT 'always_available'::text, 
  image_url_param text DEFAULT NULL::text, 
  is_active_param boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile_id UUID;
  user_family_id UUID;
  result JSON;
BEGIN
  -- Get user profile and family
  SELECT id, family_id INTO user_profile_id, user_family_id
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Update the reward with proper type casting
  UPDATE rewards 
  SET 
    title = title_param,
    description = description_param,
    cost_points = cost_points_param,
    reward_type = reward_type_param::public.reward_type,
    image_url = image_url_param,
    is_active = is_active_param,
    updated_at = now()
  WHERE id = reward_id_param 
    AND family_id = user_family_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reward not found or access denied');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Reward updated successfully');
END;
$function$;