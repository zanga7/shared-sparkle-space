-- Create storage bucket for reward images
INSERT INTO storage.buckets (id, name, public) VALUES ('reward-images', 'reward-images', true);

-- Create storage policies for reward images
CREATE POLICY "Anyone can view reward images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'reward-images');

CREATE POLICY "Parents can upload reward images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'reward-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

CREATE POLICY "Parents can update reward images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'reward-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

CREATE POLICY "Parents can delete reward images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'reward-images' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  )
);

-- Function to update reward
CREATE OR REPLACE FUNCTION public.update_reward(
  reward_id_param UUID,
  title_param TEXT,
  description_param TEXT DEFAULT NULL,
  cost_points_param INTEGER,
  reward_type_param TEXT,
  image_url_param TEXT DEFAULT NULL,
  is_active_param BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  reward_family_id UUID;
BEGIN
  -- Get current user's profile
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can update rewards');
  END IF;

  -- Get reward's family to verify ownership
  SELECT family_id INTO reward_family_id
  FROM public.rewards r
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE r.id = reward_id_param AND p.id = user_profile_id;

  IF reward_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Reward not found or access denied');
  END IF;

  -- Update the reward
  UPDATE public.rewards 
  SET 
    title = title_param,
    description = description_param,
    cost_points = cost_points_param,
    reward_type = reward_type_param,
    image_url = image_url_param,
    is_active = is_active_param,
    updated_at = NOW()
  WHERE id = reward_id_param;

  RETURN json_build_object('success', true, 'message', 'Reward updated successfully');
END;
$$;

-- Function to delete reward
CREATE OR REPLACE FUNCTION public.delete_reward(reward_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT family_id INTO reward_family_id
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
$$;