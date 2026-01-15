-- Function to sync milestone completion status based on linked tasks
CREATE OR REPLACE FUNCTION public.sync_milestone_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_linked_task RECORD;
  v_milestone_id uuid;
  v_all_tasks_completed boolean;
  v_task_count integer;
  v_completed_count integer;
BEGIN
  -- Get the task_id from either NEW (INSERT) or OLD (DELETE)
  DECLARE
    v_task_id uuid := COALESCE(NEW.task_id, OLD.task_id);
  BEGIN
    -- Find all milestones that have this task linked
    FOR v_linked_task IN 
      SELECT DISTINCT glt.milestone_id 
      FROM goal_linked_tasks glt
      WHERE glt.task_id = v_task_id
        AND glt.milestone_id IS NOT NULL
    LOOP
      v_milestone_id := v_linked_task.milestone_id;
      
      -- Count total tasks and completed tasks for this milestone
      SELECT 
        COUNT(*),
        COUNT(CASE WHEN tc.id IS NOT NULL THEN 1 END)
      INTO v_task_count, v_completed_count
      FROM goal_linked_tasks glt
      LEFT JOIN task_completions tc ON tc.task_id = glt.task_id
      WHERE glt.milestone_id = v_milestone_id
        AND glt.task_id IS NOT NULL;
      
      -- If there are tasks, check if all are completed
      IF v_task_count > 0 THEN
        v_all_tasks_completed := (v_completed_count >= v_task_count);
        
        -- Update milestone status based on task completions
        IF v_all_tasks_completed THEN
          -- All tasks completed - mark milestone as completed (if not already)
          UPDATE goal_milestones
          SET is_completed = true,
              completed_at = COALESCE(completed_at, NOW()),
              updated_at = NOW()
          WHERE id = v_milestone_id
            AND is_completed = false;
        ELSE
          -- Not all tasks completed - mark milestone as incomplete
          UPDATE goal_milestones
          SET is_completed = false,
              completed_at = NULL,
              updated_at = NOW()
          WHERE id = v_milestone_id
            AND is_completed = true;
        END IF;
      END IF;
    END LOOP;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on task_completions table
DROP TRIGGER IF EXISTS on_task_completion_change ON task_completions;
CREATE TRIGGER on_task_completion_change
  AFTER INSERT OR DELETE ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION sync_milestone_completion();