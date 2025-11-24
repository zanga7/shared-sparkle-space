-- Add hidden_at column to tasks table to track when tasks were hidden
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- Add index for better query performance when filtering hidden tasks
CREATE INDEX IF NOT EXISTS idx_tasks_hidden_at ON tasks(hidden_at) WHERE hidden_at IS NOT NULL;

-- Function to hide completed tasks
CREATE OR REPLACE FUNCTION hide_completed_tasks(p_family_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;