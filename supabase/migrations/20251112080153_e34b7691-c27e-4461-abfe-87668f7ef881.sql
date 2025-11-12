-- Now that duplicates are cleaned up, add unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_completion_per_member 
ON public.task_completions(task_id, completed_by);

-- Drop duplicate triggers that cause multiple point awards
DROP TRIGGER IF EXISTS trigger_award_task_completion_points ON public.task_completions;
DROP TRIGGER IF EXISTS award_points_on_completion ON public.task_completions;
DROP TRIGGER IF EXISTS remove_points_on_uncompletion ON public.task_completions;

-- Update the BEFORE INSERT trigger to properly derive points and enforce completion rules
CREATE OR REPLACE FUNCTION public.before_insert_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_points INTEGER;
  t_family_id UUID;
  p_family_id UUID;
  t_completion_rule TEXT;
  existing_completion_count INTEGER;
BEGIN
  -- Get task details
  SELECT points, family_id, completion_rule 
  INTO t_points, t_family_id, t_completion_rule
  FROM tasks 
  WHERE id = NEW.task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- Get completer's family
  SELECT family_id INTO p_family_id
  FROM profiles 
  WHERE id = NEW.completed_by;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  -- Validate same family
  IF t_family_id != p_family_id THEN
    RAISE EXCEPTION 'Task and profile must be in same family';
  END IF;
  
  -- Enforce completion_rule = 'any_one'
  IF t_completion_rule = 'any_one' THEN
    SELECT COUNT(*) INTO existing_completion_count
    FROM task_completions 
    WHERE task_id = NEW.task_id;
    
    IF existing_completion_count > 0 THEN
      RAISE EXCEPTION 'Task already completed (any_one rule)';
    END IF;
  END IF;
  
  -- Set points_earned from task if not explicitly provided
  -- Client should NOT set this; let the trigger derive it
  NEW.points_earned := COALESCE(NEW.points_earned, t_points, 0);
  
  RETURN NEW;
END;
$$;

-- Update complete_task_for_member RPC to remove p_points parameter
CREATE OR REPLACE FUNCTION public.complete_task_for_member(
  p_task_id UUID,
  p_completed_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  completion_id UUID;
BEGIN
  -- Insert completion record (triggers will handle points)
  INSERT INTO public.task_completions (task_id, completed_by)
  VALUES (p_task_id, p_completed_by)
  RETURNING id INTO completion_id;
  
  RETURN json_build_object(
    'success', true,
    'completion_id', completion_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Task already completed by this member'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;