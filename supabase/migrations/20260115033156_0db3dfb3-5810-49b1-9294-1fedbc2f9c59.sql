-- Fix the calculate_goal_progress function to handle date subtraction properly
CREATE OR REPLACE FUNCTION calculate_goal_progress(p_goal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
  v_goal RECORD;
  v_result JSONB;
  v_linked_task_ids UUID[];
  v_linked_series_ids UUID[];
  v_linked_rotating_ids UUID[];
  v_total_completions INT := 0;
  v_expected_completions INT := 0;
  v_current_percent NUMERIC := 0;
  v_total_days INT := 0;
  v_days_elapsed INT := 0;
  v_threshold_percent NUMERIC := 80;
  v_grace_used INT := 0;
  v_grace_remaining INT := 0;
  v_on_track BOOLEAN := TRUE;
  v_target_count INT := 0;
  v_total_tasks INT := 0;
  v_completed_tasks INT := 0;
  v_completed_milestones INT := 0;
  v_total_milestones INT := 0;
BEGIN
  -- Get goal details
  SELECT * INTO v_goal FROM goals WHERE id = p_goal_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;
  
  -- Get linked task references
  SELECT 
    array_agg(DISTINCT task_id) FILTER (WHERE task_id IS NOT NULL),
    array_agg(DISTINCT task_series_id) FILTER (WHERE task_series_id IS NOT NULL),
    array_agg(DISTINCT rotating_task_id) FILTER (WHERE rotating_task_id IS NOT NULL)
  INTO v_linked_task_ids, v_linked_series_ids, v_linked_rotating_ids
  FROM goal_linked_tasks
  WHERE goal_id = p_goal_id;
  
  -- Calculate based on goal type
  CASE v_goal.goal_type
    WHEN 'consistency' THEN
      -- Extract criteria - fix the date subtraction by casting to interval first
      v_total_days := COALESCE(
        (v_goal.success_criteria->>'time_window_days')::INT, 
        EXTRACT(DAY FROM (COALESCE(v_goal.end_date, CURRENT_DATE)::TIMESTAMP - v_goal.start_date::TIMESTAMP))::INT
      );
      v_threshold_percent := COALESCE((v_goal.success_criteria->>'threshold_percent')::NUMERIC, 80);
      
      -- Calculate days elapsed - use timestamp subtraction
      v_days_elapsed := GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE::TIMESTAMP - v_goal.start_date::TIMESTAMP))::INT);
      IF v_days_elapsed > v_total_days THEN
        v_days_elapsed := v_total_days;
      END IF;
      
      -- Count completions from task_completions for linked tasks
      SELECT COUNT(DISTINCT DATE(tc.completed_at))
      INTO v_total_completions
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE (
        t.id = ANY(COALESCE(v_linked_task_ids, ARRAY[]::UUID[]))
        OR t.rotating_task_id = ANY(COALESCE(v_linked_rotating_ids, ARRAY[]::UUID[]))
        OR EXISTS (
          SELECT 1 FROM materialized_task_instances mti 
          WHERE mti.materialized_task_id = t.id 
          AND mti.series_id = ANY(COALESCE(v_linked_series_ids, ARRAY[]::UUID[]))
        )
      )
      AND tc.completed_at >= v_goal.start_date
      AND tc.completed_at <= COALESCE(v_goal.end_date, CURRENT_DATE)
      AND (v_goal.assigned_to IS NULL OR tc.completed_by = v_goal.assigned_to);
      
      -- Calculate expected completions based on frequency
      IF v_goal.success_criteria->>'frequency' = 'weekly' THEN
        v_expected_completions := CEIL(v_days_elapsed / 7.0)::INT * 
                                  COALESCE((v_goal.success_criteria->>'times_per_week')::INT, 1);
      ELSE
        v_expected_completions := v_days_elapsed;
      END IF;
      
      -- Calculate progress percentage
      IF v_expected_completions > 0 THEN
        v_current_percent := (v_total_completions::NUMERIC / v_expected_completions::NUMERIC) * 100;
      END IF;
      
      -- Calculate grace
      v_grace_used := GREATEST(0, v_expected_completions - v_total_completions);
      v_grace_remaining := GREATEST(0, FLOOR(v_total_days * (1 - v_threshold_percent / 100))::INT - v_grace_used);
      v_on_track := v_current_percent >= v_threshold_percent OR v_grace_remaining > 0;
      
      v_result := jsonb_build_object(
        'goal_type', 'consistency',
        'total_completions', v_total_completions,
        'expected_completions', v_expected_completions,
        'days_elapsed', v_days_elapsed,
        'total_days', v_total_days,
        'current_percent', ROUND(v_current_percent, 1),
        'threshold_percent', v_threshold_percent,
        'grace_used', v_grace_used,
        'grace_remaining', v_grace_remaining,
        'on_track', v_on_track,
        'is_complete', v_days_elapsed >= v_total_days AND v_current_percent >= v_threshold_percent
      );

    WHEN 'target_count' THEN
      v_target_count := COALESCE((v_goal.success_criteria->>'target_count')::INT, 1);
      
      -- Count all completions
      SELECT COUNT(*)
      INTO v_total_completions
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE (
        t.id = ANY(COALESCE(v_linked_task_ids, ARRAY[]::UUID[]))
        OR t.rotating_task_id = ANY(COALESCE(v_linked_rotating_ids, ARRAY[]::UUID[]))
        OR EXISTS (
          SELECT 1 FROM materialized_task_instances mti 
          WHERE mti.materialized_task_id = t.id 
          AND mti.series_id = ANY(COALESCE(v_linked_series_ids, ARRAY[]::UUID[]))
        )
      )
      AND tc.completed_at >= v_goal.start_date
      AND (v_goal.end_date IS NULL OR tc.completed_at <= v_goal.end_date)
      AND (v_goal.assigned_to IS NULL OR tc.completed_by = v_goal.assigned_to);
      
      v_current_percent := LEAST(100, (v_total_completions::NUMERIC / v_target_count::NUMERIC) * 100);
      
      v_result := jsonb_build_object(
        'goal_type', 'target_count',
        'current_count', v_total_completions,
        'target_count', v_target_count,
        'current_percent', ROUND(v_current_percent, 1),
        'is_complete', v_total_completions >= v_target_count
      );

    WHEN 'project' THEN
      -- Count total linked tasks
      SELECT COUNT(*) INTO v_total_tasks FROM goal_linked_tasks WHERE goal_id = p_goal_id;
      
      -- A task is considered complete if it has at least one completion
      SELECT COUNT(DISTINCT glt.id) INTO v_completed_tasks
      FROM goal_linked_tasks glt
      WHERE glt.goal_id = p_goal_id
      AND (
        -- Regular task with completion
        (glt.task_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM task_completions tc WHERE tc.task_id = glt.task_id
        ))
        OR
        -- Series task - check materialized instance for today
        (glt.task_series_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM task_completions tc
          JOIN materialized_task_instances mti ON tc.task_id = mti.materialized_task_id
          WHERE mti.series_id = glt.task_series_id
        ))
        OR
        -- Rotating task with completion
        (glt.rotating_task_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM task_completions tc
          JOIN tasks t ON tc.task_id = t.id
          WHERE t.rotating_task_id = glt.rotating_task_id
        ))
      );
      
      -- Count milestones
      SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed)
      INTO v_total_milestones, v_completed_milestones
      FROM goal_milestones WHERE goal_id = p_goal_id;
      
      -- Calculate progress - prefer tasks if available, else use milestones
      IF v_total_tasks > 0 THEN
        v_current_percent := (v_completed_tasks::NUMERIC / v_total_tasks::NUMERIC) * 100;
      ELSIF v_total_milestones > 0 THEN
        v_current_percent := (v_completed_milestones::NUMERIC / v_total_milestones::NUMERIC) * 100;
      ELSE
        v_current_percent := 0;
      END IF;
      
      v_result := jsonb_build_object(
        'goal_type', 'project',
        'completed_tasks', v_completed_tasks,
        'total_tasks', v_total_tasks,
        'completed_milestones', v_completed_milestones,
        'total_milestones', v_total_milestones,
        'current_percent', ROUND(v_current_percent, 1),
        'is_complete', (v_total_tasks > 0 AND v_completed_tasks >= v_total_tasks) 
                       OR (v_total_tasks = 0 AND v_total_milestones > 0 AND v_completed_milestones >= v_total_milestones)
      );
    
    ELSE
      v_result := jsonb_build_object('error', 'Unknown goal type');
  END CASE;
  
  RETURN v_result;
END;
$$;