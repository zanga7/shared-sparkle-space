
-- Fix rotating tasks: hide completed tasks and prevent duplicates

-- First, hide all completed rotating tasks that aren't already hidden
UPDATE tasks 
SET hidden_at = NOW()
WHERE rotating_task_id IS NOT NULL
  AND hidden_at IS NULL
  AND EXISTS (
    SELECT 1 FROM task_completions tc WHERE tc.task_id = tasks.id
  );

-- Create a function to automatically hide completed rotating tasks
CREATE OR REPLACE FUNCTION hide_completed_rotating_task()
RETURNS TRIGGER AS $$
BEGIN
  -- When a rotating task is completed, hide it immediately
  IF EXISTS (SELECT 1 FROM tasks WHERE id = NEW.task_id AND rotating_task_id IS NOT NULL) THEN
    UPDATE tasks 
    SET hidden_at = NOW()
    WHERE id = NEW.task_id
      AND hidden_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-hide completed rotating tasks
DROP TRIGGER IF EXISTS auto_hide_completed_rotating_task ON task_completions;
CREATE TRIGGER auto_hide_completed_rotating_task
  AFTER INSERT ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION hide_completed_rotating_task();

-- Add a unique partial index to prevent multiple active (unhidden, uncompleted) rotating tasks
-- This will prevent race conditions from creating duplicate tasks
DROP INDEX IF EXISTS idx_unique_active_rotating_task;
CREATE UNIQUE INDEX idx_unique_active_rotating_task 
ON tasks (rotating_task_id) 
WHERE rotating_task_id IS NOT NULL 
  AND hidden_at IS NULL;

-- Clean up Mow: Reset to Luke (index 1) 
UPDATE rotating_tasks
SET current_member_index = 1
WHERE name = 'Mow';

-- Hide all but the oldest incomplete Rotate task (fix the duplicate)
WITH duplicate_rotate_tasks AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY rotating_task_id ORDER BY created_at ASC) as rn
  FROM tasks
  WHERE title = 'Rotate'
    AND rotating_task_id IS NOT NULL
    AND hidden_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM task_completions tc WHERE tc.task_id = tasks.id)
)
UPDATE tasks
SET hidden_at = NOW()
WHERE id IN (
  SELECT id FROM duplicate_rotate_tasks WHERE rn > 1
);
