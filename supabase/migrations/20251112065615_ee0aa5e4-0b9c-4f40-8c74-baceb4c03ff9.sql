-- Create function to remove points when task completion is deleted
CREATE OR REPLACE FUNCTION public.remove_task_completion_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  task_record RECORD;
  profile_record RECORD;
BEGIN
  -- Get task details
  SELECT t.*, p.family_id
  INTO task_record
  FROM public.tasks t
  JOIN public.profiles p ON p.id = t.created_by
  WHERE t.id = OLD.task_id;

  -- Get the completing profile's family
  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE id = OLD.completed_by;

  -- Only remove points if task and profile are in the same family
  IF task_record.family_id = profile_record.family_id THEN
    -- Remove points from the profile
    UPDATE public.profiles
    SET total_points = GREATEST(0, total_points - OLD.points_earned)
    WHERE id = OLD.completed_by;

    -- Create ledger entry for point removal
    INSERT INTO public.points_ledger (
      profile_id,
      family_id,
      entry_type,
      points,
      reason,
      task_id,
      created_by
    ) VALUES (
      OLD.completed_by,
      profile_record.family_id,
      'adjust',
      -OLD.points_earned,
      'Task uncompleted: ' || task_record.title,
      OLD.task_id,
      OLD.completed_by
    );
  END IF;

  RETURN OLD;
END;
$function$;

-- Create trigger to remove points when task completion is deleted
DROP TRIGGER IF EXISTS remove_points_on_uncompletion ON public.task_completions;

CREATE TRIGGER remove_points_on_uncompletion
  AFTER DELETE ON public.task_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_task_completion_points();