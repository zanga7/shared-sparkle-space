
-- Fix security warning: Set search_path for the hide_completed_rotating_task function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
