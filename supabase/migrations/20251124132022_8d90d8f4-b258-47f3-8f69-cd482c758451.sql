-- Fix security warning: Set search_path for hide_completed_tasks function
DROP FUNCTION IF EXISTS hide_completed_tasks(UUID);

CREATE OR REPLACE FUNCTION hide_completed_tasks(p_family_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Hide all completed tasks (tasks with completions) that aren't already hidden
  WITH completed_tasks AS (
    SELECT DISTINCT t.id
    FROM tasks t
    INNER JOIN task_completions tc ON t.id = tc.task_id
    WHERE t.family_id = p_family_id
      AND t.hidden_at IS NULL
      AND t.task_source != 'recurring' -- Don't hide materialized recurring tasks
  )
  UPDATE tasks
  SET hidden_at = NOW()
  WHERE id IN (SELECT id FROM completed_tasks);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'hidden_count', v_updated_count
  );
END;
$$;