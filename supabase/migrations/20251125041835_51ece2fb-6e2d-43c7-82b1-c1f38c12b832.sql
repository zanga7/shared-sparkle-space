-- Fix double points issue by removing duplicate points logic from complete_task_unified
-- The trigger trg_after_insert_task_completion_update_points already handles points awarding

CREATE OR REPLACE FUNCTION public.complete_task_unified(
  p_task_id uuid, 
  p_completer_profile_id uuid, 
  p_is_virtual boolean DEFAULT false, 
  p_series_id uuid DEFAULT NULL::uuid, 
  p_occurrence_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_family_id UUID;
  v_points INTEGER;
  v_completion_id UUID;
  v_materialized_task_id UUID;
  v_rotating_task RECORD;
  v_result jsonb;
BEGIN
  -- If virtual task, materialize it first
  IF p_is_virtual AND p_series_id IS NOT NULL AND p_occurrence_date IS NOT NULL THEN
    -- Check if already materialized
    SELECT materialized_task_id INTO v_materialized_task_id
    FROM materialized_task_instances
    WHERE series_id = p_series_id 
      AND occurrence_date = p_occurrence_date;
    
    IF v_materialized_task_id IS NOT NULL THEN
      -- Already materialized, use existing task
      p_task_id := v_materialized_task_id;
    ELSE
      -- Materialize the virtual task
      SELECT ts.*, ts.family_id, ts.points
      INTO v_task
      FROM task_series ts
      WHERE ts.id = p_series_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Task series not found';
      END IF;
      
      -- Create actual task from series
      INSERT INTO tasks (
        family_id,
        title,
        description,
        points,
        task_group,
        completion_rule,
        due_date,
        created_by,
        task_source
      )
      VALUES (
        v_task.family_id,
        v_task.title,
        v_task.description,
        v_task.points,
        v_task.task_group,
        v_task.completion_rule,
        p_occurrence_date::timestamptz,
        v_task.created_by,
        'recurring'
      )
      RETURNING id INTO v_materialized_task_id;
      
      -- Record materialization
      INSERT INTO materialized_task_instances (
        series_id,
        occurrence_date,
        materialized_task_id,
        materialized_by
      )
      VALUES (
        p_series_id,
        p_occurrence_date,
        v_materialized_task_id,
        p_completer_profile_id
      );
      
      -- Create assignees for materialized task
      INSERT INTO task_assignees (task_id, profile_id, assigned_by)
      SELECT v_materialized_task_id, unnest(v_task.assigned_profiles), v_task.created_by;
      
      p_task_id := v_materialized_task_id;
    END IF;
  END IF;
  
  -- Get task details
  SELECT t.*, t.family_id, t.points, t.rotating_task_id
  INTO v_task
  FROM tasks t
  WHERE t.id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  v_family_id := v_task.family_id;
  v_points := v_task.points;
  
  -- Check if already completed by this user
  IF EXISTS (
    SELECT 1 FROM task_completions 
    WHERE task_id = p_task_id 
      AND completed_by = p_completer_profile_id
  ) THEN
    RAISE EXCEPTION 'Task already completed by this user';
  END IF;
  
  -- Create completion record
  -- The trigger trg_after_insert_task_completion_update_points will:
  --   1. Update profile points
  --   2. Create points_ledger entry
  INSERT INTO task_completions (task_id, completed_by, points_earned)
  VALUES (p_task_id, p_completer_profile_id, v_points)
  RETURNING id INTO v_completion_id;
  
  -- If this is a rotating task, increment the member index
  IF v_task.rotating_task_id IS NOT NULL THEN
    SELECT * INTO v_rotating_task
    FROM rotating_tasks
    WHERE id = v_task.rotating_task_id;
    
    IF FOUND THEN
      -- Increment to next member (with wraparound)
      UPDATE rotating_tasks
      SET current_member_index = (current_member_index + 1) % array_length(member_order, 1),
          updated_at = now()
      WHERE id = v_task.rotating_task_id;
    END IF;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'task_id', p_task_id,
    'points_awarded', v_points,
    'is_rotating', v_task.rotating_task_id IS NOT NULL,
    'materialized', p_is_virtual
  );
  
  RETURN v_result;
END;
$$;