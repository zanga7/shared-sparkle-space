-- Fix the update_reward function to remove ambiguous column reference
CREATE OR REPLACE FUNCTION update_reward(
  reward_id_param UUID,
  title_param TEXT,
  description_param TEXT DEFAULT NULL,
  cost_points_param INTEGER DEFAULT 10,
  reward_type_param TEXT DEFAULT 'always_available',
  image_url_param TEXT DEFAULT NULL,
  is_active_param BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  
  -- Update the reward
  UPDATE rewards 
  SET 
    title = title_param,
    description = description_param,
    cost_points = cost_points_param,
    reward_type = reward_type_param,
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
$$;