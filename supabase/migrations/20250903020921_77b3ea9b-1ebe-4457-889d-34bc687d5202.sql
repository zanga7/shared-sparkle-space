-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the rotating task generation to run daily at 6 AM
SELECT cron.schedule(
  'generate-rotating-tasks-daily',
  '0 6 * * *', -- Daily at 6 AM
  $$
  SELECT net.http_post(
    url := 'https://timefstlnqojqidllokb.supabase.co/functions/v1/generate-rotating-task-instances',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbWVmc3RsbnFvanFpZGxsb2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTM5MTEsImV4cCI6MjA3MDQ4OTkxMX0.PkLLAvSWoK_UaBK5IltQ2hKMCMg1yoXZtSAh65pXXq4"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Create function to handle rotating task completion and move to next member
CREATE OR REPLACE FUNCTION handle_rotating_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  rotating_task_record RECORD;
  next_index INTEGER;
BEGIN
  -- Check if this is a rotating task completion
  SELECT rt.* INTO rotating_task_record
  FROM rotating_tasks rt
  JOIN tasks t ON t.title = rt.name AND t.family_id = rt.family_id
  WHERE t.id = NEW.task_id;
  
  -- If this is a rotating task, move to next member
  IF FOUND THEN
    next_index := (rotating_task_record.current_member_index + 1) % array_length(rotating_task_record.member_order, 1);
    
    UPDATE rotating_tasks 
    SET current_member_index = next_index
    WHERE id = rotating_task_record.id;
    
    -- Log the rotation
    INSERT INTO audit_logs (
      family_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      new_data
    ) VALUES (
      rotating_task_record.family_id,
      NEW.completed_by,
      'rotating_task_rotated',
      'rotating_tasks',
      rotating_task_record.id,
      json_build_object(
        'previous_member_index', rotating_task_record.current_member_index,
        'new_member_index', next_index,
        'task_completed', NEW.task_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on task completions
CREATE TRIGGER trigger_rotating_task_completion
  AFTER INSERT ON task_completions
  FOR EACH ROW
  EXECUTE FUNCTION handle_rotating_task_completion();