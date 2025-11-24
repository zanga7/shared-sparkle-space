-- Clean up duplicate rotating task instances
-- Keep only the most recent incomplete task for each rotating_task_id

-- Delete older duplicate tasks for each rotating task
WITH ranked_tasks AS (
  SELECT 
    t.id,
    t.rotating_task_id,
    t.created_at,
    COALESCE(COUNT(tc.id), 0) as completion_count,
    ROW_NUMBER() OVER (
      PARTITION BY t.rotating_task_id 
      ORDER BY t.created_at DESC
    ) as row_num
  FROM tasks t
  LEFT JOIN task_completions tc ON tc.task_id = t.id
  WHERE t.rotating_task_id IS NOT NULL
  GROUP BY t.id, t.rotating_task_id, t.created_at
),
tasks_to_delete AS (
  SELECT id 
  FROM ranked_tasks 
  WHERE row_num > 1 
    AND completion_count = 0  -- Only delete incomplete tasks
)
DELETE FROM tasks
WHERE id IN (SELECT id FROM tasks_to_delete);