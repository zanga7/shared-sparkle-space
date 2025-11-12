-- Complete the award_task_completion_points trigger function
CREATE OR REPLACE FUNCTION public.award_task_completion_points()
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
  WHERE t.id = NEW.task_id;

  -- Get the completing profile's family
  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE id = NEW.completed_by;

  -- Only award points if task and profile are in the same family
  IF task_record.family_id = profile_record.family_id THEN
    -- Update the profile's total_points directly
    UPDATE public.profiles
    SET total_points = total_points + NEW.points_earned
    WHERE id = NEW.completed_by;

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
$function$;