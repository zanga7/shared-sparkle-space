
-- Update rotating tasks to disable multiple completions
UPDATE rotating_tasks
SET allow_multiple_completions = false
WHERE name IN ('Mow', 'Bathroom', 'Dishes');

-- Clean up duplicate rotating tasks for today
-- Keep only the oldest incomplete task for each rotating task title
WITH today_tasks AS (
  SELECT 
    t.id,
    t.title,
    t.created_at,
    COALESCE(tc.id IS NOT NULL, false) as is_completed,
    ROW_NUMBER() OVER (
      PARTITION BY t.title 
      ORDER BY 
        CASE WHEN tc.id IS NULL THEN 0 ELSE 1 END, -- incomplete tasks first
        t.created_at ASC -- then oldest first
    ) as row_num
  FROM tasks t
  LEFT JOIN task_completions tc ON tc.task_id = t.id
  WHERE t.title IN ('Mow', 'Bathroom', 'Dishes')
    AND t.created_at >= CURRENT_DATE
    AND t.created_at < CURRENT_DATE + INTERVAL '1 day'
)
DELETE FROM tasks
WHERE id IN (
  SELECT id 
  FROM today_tasks 
  WHERE row_num > 1
);
