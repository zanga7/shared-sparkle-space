-- Function to award points when task is completed
CREATE OR REPLACE FUNCTION public.award_task_completion_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record RECORD;
  profile_record RECORD;
BEGIN
  -- Get task details
  SELECT t.*, p.family_id
  INTO task_record
  FROM public.tasks t
  JOIN public.profiles p ON p.id = t.created_by
  WHERE t.id = NEW.task_id;

  -- Get the completing profile's family
  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE id = NEW.completed_by;

  -- Only award points if task and profile are in the same family
  IF task_record.family_id = profile_record.family_id THEN
    -- Create ledger entry for earning points
    INSERT INTO public.points_ledger (
      profile_id,
      family_id,
      entry_type,
      points,
      reason,
      task_id,
      created_by
    ) VALUES (
      NEW.completed_by,
      profile_record.family_id,
      'earn',
      NEW.points_earned,
      'Task completed: ' || task_record.title,
      NEW.task_id,
      NEW.completed_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic points awarding
CREATE TRIGGER trigger_award_task_completion_points
  AFTER INSERT ON public.task_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_task_completion_points();

-- Function to deny reward request
CREATE OR REPLACE FUNCTION public.deny_reward_request(
  request_id_param UUID,
  denial_note_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
  approver_profile_id UUID;
BEGIN
  -- Get approver's profile
  SELECT id INTO approver_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF approver_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can deny requests');
  END IF;

  -- Get request details
  SELECT rr.*, r.family_id
  INTO request_record
  FROM public.reward_requests rr
  JOIN public.rewards r ON r.id = rr.reward_id
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE rr.id = request_id_param 
  AND rr.status = 'pending'
  AND p.id = approver_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  -- Update request status
  UPDATE public.reward_requests 
  SET 
    status = 'denied',
    approved_by = approver_profile_id,
    approval_note = denial_note_param,
    updated_at = NOW()
  WHERE id = request_id_param;

  RETURN json_build_object('success', true, 'message', 'Reward request denied');
END;
$$;