
-- Fix hide_completed_tasks to respect the household's completed_tasks_hide_hours setting
DROP FUNCTION IF EXISTS hide_completed_tasks(UUID);

CREATE OR REPLACE FUNCTION hide_completed_tasks(p_family_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
  v_hide_hours INTEGER;
BEGIN
  -- Get the hide hours setting for this family
  SELECT COALESCE(completed_tasks_hide_hours, 12)
  INTO v_hide_hours
  FROM household_settings
  WHERE family_id = p_family_id;

  -- Default to 12 hours if no setting found
  IF v_hide_hours IS NULL THEN
    v_hide_hours := 12;
  END IF;

  -- Hide completed tasks where the completion happened more than v_hide_hours ago
  WITH tasks_to_hide AS (
    SELECT DISTINCT t.id
    FROM tasks t
    INNER JOIN task_completions tc ON t.id = tc.task_id
    WHERE t.family_id = p_family_id
      AND t.hidden_at IS NULL
      AND tc.completed_at < NOW() - (v_hide_hours || ' hours')::INTERVAL
      AND (t.task_source IS NULL OR t.task_source != 'recurring')
  )
  UPDATE tasks
  SET hidden_at = NOW()
  WHERE id IN (SELECT id FROM tasks_to_hide);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'hidden_count', v_updated_count,
    'hide_hours', v_hide_hours
  );
END;
$$;
