
DROP FUNCTION IF EXISTS generate_rotating_task_instance(uuid);

CREATE FUNCTION generate_rotating_task_instance(rotating_task_id_param UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rotating_task_record RECORD;
  current_member_id UUID;
  new_task_id UUID;
  due_date TIMESTAMP WITH TIME ZONE;
  should_generate BOOLEAN := false;
  existing_task_count INTEGER;
BEGIN
  SELECT * INTO rotating_task_record
  FROM rotating_tasks 
  WHERE id = rotating_task_id_param
  AND is_active = true 
  AND is_paused = false;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  current_member_id := rotating_task_record.member_order[rotating_task_record.current_member_index + 1];
  
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
  
  -- Check for existing incomplete visible tasks for this rotating task
  SELECT COUNT(*) INTO existing_task_count
  FROM tasks t
  WHERE t.rotating_task_id = rotating_task_id_param
  AND t.hidden_at IS NULL;
  
  IF existing_task_count > 0 THEN
    RETURN NULL;
  END IF;
  
  due_date := DATE_TRUNC('day', NOW()) + INTERVAL '9 hours';
  
  -- Create task WITH rotating_task_id properly set
  INSERT INTO tasks (
    title, description, points, assigned_to, family_id, created_by, due_date, task_group, rotating_task_id
  ) VALUES (
    rotating_task_record.name, rotating_task_record.description, rotating_task_record.points,
    current_member_id, rotating_task_record.family_id, rotating_task_record.created_by,
    due_date, rotating_task_record.task_group, rotating_task_id_param
  ) RETURNING id INTO new_task_id;
  
  INSERT INTO task_assignees (task_id, profile_id, assigned_by, assigned_at)
  VALUES (new_task_id, current_member_id, rotating_task_record.created_by, NOW());
  
  RETURN new_task_id;
END;
$$;

-- Also update the trigger to pass the correct parameter
CREATE OR REPLACE FUNCTION handle_rotating_task_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_task_id UUID;
BEGIN
  new_task_id := generate_rotating_task_instance(NEW.id);
  RETURN NEW;
END;
$$;
