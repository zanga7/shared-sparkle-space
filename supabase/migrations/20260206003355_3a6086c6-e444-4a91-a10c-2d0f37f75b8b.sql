-- Fix the handle_rotating_task_completion trigger to respect rotate_on_completion setting
-- and use hidden_at for checking existing tasks instead of date-based logic

CREATE OR REPLACE FUNCTION handle_rotating_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_rotating_task rotating_tasks%ROWTYPE;
  v_member_order UUID[];
  v_len INT;
  v_original_index INT;
  v_selected_index INT;
  v_next_index INT;
  v_target_member_id UUID;
  v_candidate_id UUID;
  v_is_valid BOOLEAN;
  v_new_task_id UUID;
  v_task_group TEXT;
  v_due_date TIMESTAMPTZ;
  v_has_incomplete BOOLEAN;
BEGIN
  -- Only proceed if this is an INSERT (new completion)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if the completed task is a rotating task with instant rotation enabled
  SELECT rt.* INTO v_rotating_task
  FROM tasks t
  JOIN rotating_tasks rt ON rt.id = t.rotating_task_id
  WHERE t.id = NEW.task_id
    AND rt.is_active = true
    AND rt.is_paused = false
    AND rt.rotate_on_completion = true  -- Only handle instant rotation tasks
  FOR UPDATE; -- Lock the rotating_tasks row

  IF NOT FOUND THEN
    -- Not a rotating task, not active/paused, or uses scheduled rotation
    RETURN NEW;
  END IF;

  -- Initialize variables
  v_member_order := v_rotating_task.member_order;
  v_len := array_length(v_member_order, 1);
  v_original_index := v_rotating_task.current_member_index;
  v_task_group := v_rotating_task.task_group;

  IF v_len = 0 OR v_len IS NULL THEN
    -- No members in rotation
    INSERT INTO rotation_events (
      family_id, rotating_task_id, source,
      previous_index, selected_index, next_index,
      chosen_member_id, new_task_id,
      status, reason
    ) VALUES (
      v_rotating_task.family_id, v_rotating_task.id, 'db_trigger',
      v_original_index, v_original_index, v_original_index,
      NULL, NULL,
      'failed', 'No members defined in rotation'
    );
    RETURN NEW;
  END IF;

  -- For instant rotation, check if there's any VISIBLE incomplete task (hidden_at IS NULL)
  -- We use hidden_at because completed rotating tasks are immediately hidden
  SELECT EXISTS (
    SELECT 1 FROM tasks t2
    WHERE t2.rotating_task_id = v_rotating_task.id
      AND t2.hidden_at IS NULL  -- Only visible tasks
      AND t2.id != NEW.task_id  -- Exclude the just-completed task
      AND NOT EXISTS (
        SELECT 1 FROM task_completions tc
        WHERE tc.task_id = t2.id
      )
  ) INTO v_has_incomplete;

  IF v_has_incomplete THEN
    -- Already has an incomplete visible instance
    INSERT INTO rotation_events (
      family_id, rotating_task_id, source,
      previous_index, selected_index, next_index,
      chosen_member_id, new_task_id,
      status, reason
    ) VALUES (
      v_rotating_task.family_id, v_rotating_task.id, 'db_trigger',
      v_original_index, v_original_index, v_original_index,
      NULL, NULL,
      'skipped', 'Incomplete visible task already exists'
    );
    RETURN NEW;
  END IF;

  -- Advance to the next member in rotation
  v_selected_index := (v_original_index + 1) % v_len;

  -- Find the next valid member starting from the new position
  FOR i IN 0..(v_len - 1) LOOP
    v_candidate_id := v_member_order[(v_selected_index + i) % v_len + 1]; -- PostgreSQL arrays are 1-indexed

    -- Validate that the candidate exists in profiles for this family
    SELECT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_candidate_id
        AND p.family_id = v_rotating_task.family_id
    ) INTO v_is_valid;

    IF v_is_valid THEN
      v_target_member_id := v_candidate_id;
      v_selected_index := (v_selected_index + i) % v_len;
      EXIT;
    END IF;
  END LOOP;

  IF v_target_member_id IS NULL THEN
    -- No valid members found
    INSERT INTO rotation_events (
      family_id, rotating_task_id, source,
      previous_index, selected_index, next_index,
      chosen_member_id, new_task_id,
      status, reason
    ) VALUES (
      v_rotating_task.family_id, v_rotating_task.id, 'db_trigger',
      v_original_index, v_original_index, v_original_index,
      NULL, NULL,
      'failed', 'No valid members available in rotation'
    );
    RETURN NEW;
  END IF;

  -- Calculate due_date based on task_group
  CASE v_task_group
    WHEN 'morning' THEN
      v_due_date := date_trunc('day', now()) + interval '11 hours';
    WHEN 'midday' THEN
      v_due_date := date_trunc('day', now()) + interval '15 hours';
    WHEN 'afternoon' THEN
      v_due_date := date_trunc('day', now()) + interval '18 hours';
    WHEN 'evening' THEN
      v_due_date := date_trunc('day', now()) + interval '23 hours 59 minutes';
    ELSE
      v_due_date := NULL;
  END CASE;

  -- Create the new task for the next member
  INSERT INTO tasks (
    family_id, title, description, points, created_by,
    task_group, due_date, completion_rule, rotating_task_id
  ) VALUES (
    v_rotating_task.family_id,
    v_rotating_task.name,
    v_rotating_task.description,
    v_rotating_task.points,
    v_rotating_task.created_by,
    v_task_group,
    v_due_date,
    'everyone',
    v_rotating_task.id
  ) RETURNING id INTO v_new_task_id;

  -- Assign the task to the target member
  INSERT INTO task_assignees (task_id, profile_id, assigned_by)
  VALUES (v_new_task_id, v_target_member_id, v_rotating_task.created_by);

  -- Update the rotation index to prepare for the NEXT rotation
  v_next_index := (v_selected_index + 1) % v_len;
  UPDATE rotating_tasks
  SET current_member_index = v_next_index,
      updated_at = now()
  WHERE id = v_rotating_task.id;

  -- Log successful rotation
  INSERT INTO rotation_events (
    family_id, rotating_task_id, source,
    previous_index, selected_index, next_index,
    chosen_member_id, new_task_id,
    status, reason
  ) VALUES (
    v_rotating_task.family_id, v_rotating_task.id, 'db_trigger',
    v_original_index, v_selected_index, v_next_index,
    v_target_member_id, v_new_task_id,
    'success', NULL
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failure
    INSERT INTO rotation_events (
      family_id, rotating_task_id, source,
      previous_index, selected_index, next_index,
      chosen_member_id, new_task_id,
      status, reason
    ) VALUES (
      v_rotating_task.family_id, v_rotating_task.id, 'db_trigger',
      v_original_index, v_selected_index, NULL,
      v_target_member_id, NULL,
      'failed', 'Exception: ' || SQLERRM
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;