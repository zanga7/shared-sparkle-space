-- Task completion points handling: ensure completing tasks updates member totals and ledger, and reversing does the opposite

-- 1) BEFORE INSERT: validate family and set points_earned
CREATE OR REPLACE FUNCTION public.before_insert_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_family uuid;
  t_points integer;
  t_title text;
  p_family uuid;
BEGIN
  -- Load task details
  SELECT family_id, points, title INTO t_family, t_points, t_title
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF t_family IS NULL THEN
    RAISE EXCEPTION 'Task not found for completion';
  END IF;

  -- Load completer profile family
  SELECT family_id INTO p_family
  FROM public.profiles
  WHERE id = NEW.completed_by;

  IF p_family IS NULL THEN
    RAISE EXCEPTION 'Completer profile not found';
  END IF;

  -- Enforce same family
  IF p_family <> t_family THEN
    RAISE EXCEPTION 'Cannot complete tasks across families';
  END IF;

  -- Ensure points_earned is set
  NEW.points_earned := COALESCE(NEW.points_earned, t_points, 0);

  RETURN NEW;
END;
$$;

-- 2) AFTER INSERT: add points to profile and create ledger entry
CREATE OR REPLACE FUNCTION public.after_insert_task_completion_update_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_family uuid;
  t_title text;
BEGIN
  -- Get task family and title for ledger
  SELECT family_id, title INTO t_family, t_title
  FROM public.tasks
  WHERE id = NEW.task_id;

  -- Update points balance
  UPDATE public.profiles
  SET total_points = COALESCE(total_points, 0) + COALESCE(NEW.points_earned, 0),
      updated_at = now()
  WHERE id = NEW.completed_by;

  -- Create ledger entry (earn)
  INSERT INTO public.points_ledger (
    profile_id,
    family_id,
    entry_type,
    points,
    reason,
    created_by
  ) VALUES (
    NEW.completed_by,
    t_family,
    'earn',
    COALESCE(NEW.points_earned, 0),
    'Task: ' || COALESCE(t_title, 'Unknown Task'),
    NEW.completed_by
  );

  RETURN NEW;
END;
$$;

-- 3) AFTER DELETE: subtract points and create reversal ledger entry
CREATE OR REPLACE FUNCTION public.after_delete_task_completion_update_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_family uuid;
  t_title text;
BEGIN
  -- Get task family and title for ledger
  SELECT family_id, title INTO t_family, t_title
  FROM public.tasks
  WHERE id = OLD.task_id;

  -- Deduct points (never below 0 implicitly allowed; clamp if needed)
  UPDATE public.profiles
  SET total_points = COALESCE(total_points, 0) - COALESCE(OLD.points_earned, 0),
      updated_at = now()
  WHERE id = OLD.completed_by;

  -- Create ledger entry (reversal)
  INSERT INTO public.points_ledger (
    profile_id,
    family_id,
    entry_type,
    points,
    reason,
    created_by
  ) VALUES (
    OLD.completed_by,
    t_family,
    'adjust',
    -COALESCE(OLD.points_earned, 0),
    'Task reversal: ' || COALESCE(t_title, 'Unknown Task'),
    OLD.completed_by
  );

  RETURN OLD;
END;
$$;

-- Drop existing triggers if any to avoid duplicates
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_before_insert_task_completion'
  ) THEN
    DROP TRIGGER trg_before_insert_task_completion ON public.task_completions;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_after_insert_task_completion_update_points'
  ) THEN
    DROP TRIGGER trg_after_insert_task_completion_update_points ON public.task_completions;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_after_delete_task_completion_update_points'
  ) THEN
    DROP TRIGGER trg_after_delete_task_completion_update_points ON public.task_completions;
  END IF;
END $$;

-- Create triggers
CREATE TRIGGER trg_before_insert_task_completion
BEFORE INSERT ON public.task_completions
FOR EACH ROW
EXECUTE FUNCTION public.before_insert_task_completion();

CREATE TRIGGER trg_after_insert_task_completion_update_points
AFTER INSERT ON public.task_completions
FOR EACH ROW
EXECUTE FUNCTION public.after_insert_task_completion_update_points();

CREATE TRIGGER trg_after_delete_task_completion_update_points
AFTER DELETE ON public.task_completions
FOR EACH ROW
EXECUTE FUNCTION public.after_delete_task_completion_update_points();