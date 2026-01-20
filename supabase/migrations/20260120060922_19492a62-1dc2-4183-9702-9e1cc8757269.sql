CREATE OR REPLACE FUNCTION public.calculate_goals_progress_batch(p_goal_ids uuid[])
RETURNS TABLE(
  goal_id uuid,
  current_value numeric,
  target_value numeric,
  percentage numeric,
  completed_tasks integer,
  total_tasks integer,
  total_completions integer,
  expected_completions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH goal_data AS (
    SELECT 
      g.id,
      g.goal_type,
      g.success_criteria,
      g.start_date,
      g.end_date
    FROM goals g
    WHERE g.id = ANY(p_goal_ids)
  ),
  -- Count linked tasks per goal
  task_counts AS (
    SELECT 
      glt.goal_id,
      COUNT(DISTINCT COALESCE(glt.task_id, glt.task_series_id, glt.rotating_task_id)) as total_linked
    FROM goal_linked_tasks glt
    WHERE glt.goal_id = ANY(p_goal_ids)
    GROUP BY glt.goal_id
  ),
  -- Count completed linked tasks per goal (for project AND target_count goals)
  completed_counts AS (
    SELECT 
      glt.goal_id,
      COUNT(DISTINCT tc.id) as completed_count
    FROM goal_linked_tasks glt
    JOIN tasks t ON t.id = glt.task_id
    JOIN task_completions tc ON tc.task_id = t.id
    WHERE glt.goal_id = ANY(p_goal_ids)
      AND glt.task_id IS NOT NULL
    GROUP BY glt.goal_id
  ),
  -- For consistency goals: count completions within time window
  consistency_completions AS (
    SELECT 
      gd.id as goal_id,
      COUNT(DISTINCT DATE(tc.completed_at)) as completion_days,
      GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - gd.start_date::timestamp))::integer) as days_elapsed
    FROM goal_data gd
    JOIN goal_linked_tasks glt ON glt.goal_id = gd.id
    LEFT JOIN task_series ts ON ts.id = glt.task_series_id
    LEFT JOIN materialized_task_instances mti ON mti.series_id = ts.id
    LEFT JOIN tasks t ON t.id = mti.materialized_task_id
    LEFT JOIN task_completions tc ON tc.task_id = t.id
    WHERE gd.goal_type = 'consistency'
      AND tc.completed_at >= gd.start_date::timestamp
    GROUP BY gd.id, gd.start_date
  )
  SELECT 
    gd.id as goal_id,
    CASE 
      -- target_count: current_value is the count of completed tasks
      WHEN gd.goal_type = 'target_count' THEN COALESCE(cc.completed_count, 0)::numeric
      WHEN gd.goal_type = 'project' THEN COALESCE(cc.completed_count, 0)::numeric
      WHEN gd.goal_type = 'consistency' THEN COALESCE(csc.completion_days, 0)::numeric
      ELSE 0
    END as current_value,
    CASE 
      -- target_count: target_value comes from success_criteria
      WHEN gd.goal_type = 'target_count' THEN COALESCE((gd.success_criteria->>'target_count')::numeric, 1)
      WHEN gd.goal_type = 'project' THEN GREATEST(COALESCE(tc.total_linked, 0), 1)::numeric
      WHEN gd.goal_type = 'consistency' THEN COALESCE((gd.success_criteria->>'time_window_days')::numeric, 30)
      ELSE 1
    END as target_value,
    CASE 
      -- target_count: percentage = completed_tasks / target_count * 100
      WHEN gd.goal_type = 'target_count' THEN 
        LEAST(100, ROUND(COALESCE(cc.completed_count, 0)::numeric / 
          NULLIF(COALESCE((gd.success_criteria->>'target_count')::numeric, 1), 0) * 100, 0))
      WHEN gd.goal_type = 'project' THEN 
        CASE WHEN COALESCE(tc.total_linked, 0) = 0 THEN 0
             ELSE LEAST(100, ROUND(COALESCE(cc.completed_count, 0)::numeric / tc.total_linked * 100, 0))
        END
      WHEN gd.goal_type = 'consistency' THEN 
        CASE WHEN COALESCE(csc.days_elapsed, 1) = 0 THEN 0
             ELSE LEAST(100, ROUND(COALESCE(csc.completion_days, 0)::numeric / 
               COALESCE((gd.success_criteria->>'time_window_days')::numeric, 30) * 100, 0))
        END
      ELSE 0
    END as percentage,
    COALESCE(cc.completed_count, 0)::integer as completed_tasks,
    COALESCE(tc.total_linked, 0)::integer as total_tasks,
    COALESCE(csc.completion_days, 0)::integer as total_completions,
    COALESCE((gd.success_criteria->>'time_window_days')::integer, 30) as expected_completions
  FROM goal_data gd
  LEFT JOIN task_counts tc ON tc.goal_id = gd.id
  LEFT JOIN completed_counts cc ON cc.goal_id = gd.id
  LEFT JOIN consistency_completions csc ON csc.goal_id = gd.id;
END;
$$;