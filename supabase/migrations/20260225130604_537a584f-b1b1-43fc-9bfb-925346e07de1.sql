
-- Fix: Sync task_series assigned_profiles with goal_assignees
-- This ensures all goal participants are included in the linked series
UPDATE task_series ts
SET assigned_profiles = (
  SELECT ARRAY_AGG(DISTINCT ga.profile_id)
  FROM goal_linked_tasks glt
  JOIN goal_assignees ga ON ga.goal_id = glt.goal_id
  WHERE glt.task_series_id = ts.id
)
WHERE ts.id IN (
  SELECT task_series_id FROM goal_linked_tasks WHERE task_series_id IS NOT NULL
)
AND (
  SELECT COUNT(DISTINCT ga.profile_id)
  FROM goal_linked_tasks glt
  JOIN goal_assignees ga ON ga.goal_id = glt.goal_id
  WHERE glt.task_series_id = ts.id
) > array_length(ts.assigned_profiles, 1);

-- Also delete stale completion for today's Run task so Lotte can re-complete
-- The task 72e2b19a was materialized with completion_rule 'everyone' but only Luke in assignees
-- Lotte's completion went to Luke's task, creating a conflict
DELETE FROM task_completions
WHERE task_id = '72e2b19a-8525-4bf1-9448-1f56d5628576'
AND completed_by = '8f76fa59-c8ca-47d8-88d2-a937e81ab01a';

-- Restore Lotte's points that were awarded for the stale completion
UPDATE profiles
SET total_points = total_points - (SELECT points FROM tasks WHERE id = '72e2b19a-8525-4bf1-9448-1f56d5628576')
WHERE id = '8f76fa59-c8ca-47d8-88d2-a937e81ab01a'
AND total_points >= (SELECT points FROM tasks WHERE id = '72e2b19a-8525-4bf1-9448-1f56d5628576');
