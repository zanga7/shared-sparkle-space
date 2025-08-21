-- Fix the delete_reward function to resolve ambiguous family_id column reference
CREATE OR REPLACE FUNCTION public.delete_reward(reward_id_param uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_profile_id UUID;
  reward_family_id UUID;
BEGIN
  -- Get current user's profile
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can delete rewards');
  END IF;

  -- Get reward's family to verify ownership
  SELECT r.family_id INTO reward_family_id
  FROM public.rewards r
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE r.id = reward_id_param AND p.id = user_profile_id;

  IF reward_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Reward not found or access denied');
  END IF;

  -- Check if there are any pending requests for this reward
  IF EXISTS (
    SELECT 1 FROM public.reward_requests 
    WHERE reward_id = reward_id_param AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete reward with pending requests');
  END IF;

  -- Mark as inactive instead of deleting to preserve history
  UPDATE public.rewards 
  SET is_active = false, updated_at = NOW()
  WHERE id = reward_id_param;

  RETURN json_build_object('success', true, 'message', 'Reward deactivated successfully');
END;
$function$