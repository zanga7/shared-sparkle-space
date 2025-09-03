-- Add allow_multiple_completions field to rotating_tasks table
ALTER TABLE public.rotating_tasks 
ADD COLUMN allow_multiple_completions boolean NOT NULL DEFAULT false;

-- Update the task generation function to support multiple completions
CREATE OR REPLACE FUNCTION generate_rotating_task_instance(rotating_task_id UUID)
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
  
  -- Check for existing tasks only if multiple completions are not allowed
  IF NOT rotating_task_record.allow_multiple_completions THEN
    CASE rotating_task_record.cadence
      WHEN 'daily' THEN
        -- Check for existing task today
        SELECT COUNT(*) INTO existing_task_count
        FROM tasks t
        WHERE t.title = rotating_task_record.name
        AND t.family_id = rotating_task_record.family_id
        AND DATE(t.due_date) = CURRENT_DATE;
        
      WHEN 'weekly' THEN
        -- Check for existing task this week
        SELECT COUNT(*) INTO existing_task_count
        FROM tasks t
        WHERE t.title = rotating_task_record.name
        AND t.family_id = rotating_task_record.family_id
        AND EXTRACT(WEEK FROM t.due_date) = EXTRACT(WEEK FROM NOW())
        AND EXTRACT(YEAR FROM t.due_date) = EXTRACT(YEAR FROM NOW());
        
      WHEN 'monthly' THEN
        -- Check for existing task this month
        SELECT COUNT(*) INTO existing_task_count
        FROM tasks t
        WHERE t.title = rotating_task_record.name
        AND t.family_id = rotating_task_record.family_id
        AND EXTRACT(MONTH FROM t.due_date) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM t.due_date) = EXTRACT(YEAR FROM NOW());
        
      ELSE
        existing_task_count := 0;
    END CASE;
    
    -- If task already exists for this period, don't generate another
    IF existing_task_count > 0 THEN
      RETURN NULL;
    END IF;
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
$$;