-- Remove the cron job we no longer need
SELECT cron.unschedule('generate-rotating-tasks-daily');

-- Create function to generate a single task instance from a rotating task
CREATE OR REPLACE FUNCTION generate_rotating_task_instance(rotating_task_id UUID)
RETURNS UUID AS $$
DECLARE
  rotating_task_record RECORD;
  current_member_id UUID;
  new_task_id UUID;
  due_date TIMESTAMP WITH TIME ZONE;
  should_generate BOOLEAN := false;
BEGIN
  -- Get the rotating task details
  SELECT * INTO rotating_task_record
  FROM rotating_tasks 
  WHERE id = rotating_task_id 
  AND is_active = true 
  AND is_paused = false;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Get current member from rotation
  current_member_id := rotating_task_record.member_order[rotating_task_record.current_member_index + 1];
  
  -- Check if we should generate based on cadence
  CASE rotating_task_record.cadence
    WHEN 'daily' THEN
      should_generate := true;
    WHEN 'weekly' THEN
      should_generate := (
        rotating_task_record.weekly_days IS NULL OR 
        array_length(rotating_task_record.weekly_days, 1) = 0 OR
        EXTRACT(DOW FROM NOW()) = ANY(rotating_task_record.weekly_days)
      );
    WHEN 'monthly' THEN
      should_generate := (
        rotating_task_record.monthly_day IS NULL OR
        EXTRACT(DAY FROM NOW()) = rotating_task_record.monthly_day
      );
    ELSE
      should_generate := false;
  END CASE;
  
  IF NOT should_generate THEN
    RETURN NULL;
  END IF;
  
  -- Check if task already exists for today for this rotating task
  IF EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.title = rotating_task_record.name
    AND t.family_id = rotating_task_record.family_id
    AND t.assigned_to = current_member_id
    AND DATE(t.due_date) = CURRENT_DATE
  ) THEN
    RETURN NULL;
  END IF;
  
  -- Set due date (default to 9 AM today)
  due_date := DATE_TRUNC('day', NOW()) + INTERVAL '9 hours';
  
  -- Create the task instance
  INSERT INTO tasks (
    title,
    description,
    points,
    assigned_to,
    family_id,
    created_by,
    due_date,
    task_group
  ) VALUES (
    rotating_task_record.name,
    rotating_task_record.description,
    rotating_task_record.points,
    current_member_id,
    rotating_task_record.family_id,
    rotating_task_record.created_by,
    due_date,
    rotating_task_record.task_group
  ) RETURNING id INTO new_task_id;
  
  -- Create task assignee entry
  INSERT INTO task_assignees (
    task_id,
    profile_id,
    assigned_by,
    assigned_at
  ) VALUES (
    new_task_id,
    current_member_id,
    rotating_task_record.created_by,
    NOW()
  );
  
  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for when rotating tasks are created
CREATE OR REPLACE FUNCTION handle_rotating_task_creation()
RETURNS TRIGGER AS $$
DECLARE
  new_task_id UUID;
BEGIN
  -- Generate the first task instance immediately
  new_task_id := generate_rotating_task_instance(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rotating task creation
CREATE TRIGGER trigger_rotating_task_creation
  AFTER INSERT ON rotating_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_rotating_task_creation();

-- Enhanced function to handle rotating task completion and move to next member
CREATE OR REPLACE FUNCTION handle_rotating_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  rotating_task_record RECORD;
  next_index INTEGER;
  new_task_id UUID;
BEGIN
  -- Check if this is a rotating task completion
  SELECT rt.* INTO rotating_task_record
  FROM rotating_tasks rt
  JOIN tasks t ON t.title = rt.name AND t.family_id = rt.family_id
  WHERE t.id = NEW.task_id;
  
  -- If this is a rotating task, move to next member and generate new task
  IF FOUND THEN
    next_index := (rotating_task_record.current_member_index + 1) % array_length(rotating_task_record.member_order, 1);
    
    -- Update the rotating task to next member
    UPDATE rotating_tasks 
    SET current_member_index = next_index
    WHERE id = rotating_task_record.id;
    
    -- Generate new task instance for the next member
    new_task_id := generate_rotating_task_instance(rotating_task_record.id);
    
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
        'task_completed', NEW.task_id,
        'new_task_generated', new_task_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;