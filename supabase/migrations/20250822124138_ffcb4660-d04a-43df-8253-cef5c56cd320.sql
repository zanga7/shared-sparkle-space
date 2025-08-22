-- Create function to handle group contribution completion
CREATE OR REPLACE FUNCTION public.handle_group_contribution_completion()
RETURNS TRIGGER AS $$
DECLARE
  reward_record RECORD;
  contribution_count INTEGER;
  required_contributors INTEGER;
BEGIN
  -- Get the reward details
  SELECT * INTO reward_record
  FROM public.rewards 
  WHERE id = NEW.reward_id AND reward_type = 'group_contribution';
  
  -- If not a group contribution reward, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get required number of contributors (based on assigned_to array length, or 1 if null)
  required_contributors := COALESCE(array_length(reward_record.assigned_to, 1), 1);
  
  -- Count unique contributors who have contributed the full amount
  SELECT COUNT(DISTINCT profile_id) INTO contribution_count
  FROM public.group_contributions
  WHERE reward_id = NEW.reward_id 
  AND points_contributed >= reward_record.cost_points;
  
  -- If we have enough contributors, mark reward as inactive and create approval
  IF contribution_count >= required_contributors THEN
    -- Deactivate the reward
    UPDATE public.rewards 
    SET is_active = false, updated_at = NOW()
    WHERE id = NEW.reward_id;
    
    -- Create reward request with 'approved' status for group contribution
    INSERT INTO public.reward_requests (
      reward_id,
      requested_by,
      points_cost,
      status,
      approval_note,
      created_at,
      updated_at
    ) VALUES (
      NEW.reward_id,
      NEW.profile_id, -- Use the contributor who completed the goal
      0, -- No points cost as they've already been deducted via contributions
      'approved',
      'Group contribution goal completed automatically',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after group contribution insert
CREATE TRIGGER group_contribution_completion_trigger
  AFTER INSERT ON public.group_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_group_contribution_completion();

-- Add constraint to prevent duplicate contributions per user per reward
ALTER TABLE public.group_contributions 
ADD CONSTRAINT unique_profile_reward_contribution 
UNIQUE (profile_id, reward_id);