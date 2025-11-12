-- Allow parents in dashboard mode to complete tasks on behalf of a member
CREATE OR REPLACE FUNCTION public.complete_task_for_member(p_task_id uuid, p_completed_by uuid, p_points integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parent_profile RECORD;
  target_profile RECORD;
  task_record RECORD;
BEGIN
  -- Validate caller is a parent
  SELECT * INTO parent_profile
  FROM public.profiles
  WHERE user_id = auth.uid() AND role = 'parent';

  IF parent_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can complete for members');
  END IF;

  -- Validate target profile exists and is in same family
  SELECT * INTO target_profile FROM public.profiles WHERE id = p_completed_by;
  IF target_profile IS NULL OR target_profile.family_id <> parent_profile.family_id THEN
    RETURN json_build_object('success', false, 'error', 'Target profile not found or not in family');
  END IF;

  -- Validate task belongs to same family
  SELECT * INTO task_record FROM public.tasks WHERE id = p_task_id;
  IF task_record IS NULL OR task_record.family_id <> parent_profile.family_id THEN
    RETURN json_build_object('success', false, 'error', 'Task not found or not in family');
  END IF;

  -- Insert completion (bypasses RLS via SECURITY DEFINER)
  INSERT INTO public.task_completions (task_id, completed_by, points_earned)
  VALUES (p_task_id, p_completed_by, p_points);

  RETURN json_build_object('success', true);
END;
$function$;

-- Allow parents to uncomplete on behalf of a member
CREATE OR REPLACE FUNCTION public.uncomplete_task_for_member(p_completion_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parent_profile RECORD;
  completion_record RECORD;
  task_record RECORD;
BEGIN
  -- Validate caller is a parent
  SELECT * INTO parent_profile
  FROM public.profiles
  WHERE user_id = auth.uid() AND role = 'parent';

  IF parent_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can uncomplete for members');
  END IF;

  SELECT tc.*, t.family_id INTO completion_record
  FROM public.task_completions tc
  JOIN public.tasks t ON t.id = tc.task_id
  WHERE tc.id = p_completion_id;

  IF completion_record IS NULL OR completion_record.family_id <> parent_profile.family_id THEN
    RETURN json_build_object('success', false, 'error', 'Completion not found or not in family');
  END IF;

  -- Delete completion (triggers handle points reversal)
  DELETE FROM public.task_completions WHERE id = p_completion_id;

  RETURN json_build_object('success', true);
END;
$function$;