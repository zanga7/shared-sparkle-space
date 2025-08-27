-- Phase 2: Database cleanup for task generation bug

-- Reset watermarks for task series that failed generation
UPDATE task_series 
SET last_generated_through = NULL 
WHERE family_id = 'dbc515c9-220c-4084-ba1e-934456cc27e3' 
AND is_active = true;

-- Clean up any duplicate recurring tasks that may have been created during the error period
WITH ranked_recurring_duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY series_id, due_date, family_id 
      ORDER BY created_at ASC
    ) as rn
  FROM tasks
  WHERE series_id IS NOT NULL
  AND family_id = 'dbc515c9-220c-4084-ba1e-934456cc27e3'
)
DELETE FROM tasks 
WHERE id IN (
  SELECT id FROM ranked_recurring_duplicates WHERE rn > 1
);

-- Clean up any duplicate rotating tasks that may have been created during the error period
WITH ranked_rotating_duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, assigned_to, due_date, family_id 
      ORDER BY created_at ASC
    ) as rn
  FROM tasks
  WHERE task_group = 'rotating'
  AND family_id = 'dbc515c9-220c-4084-ba1e-934456cc27e3'
)
DELETE FROM tasks 
WHERE id IN (
  SELECT id FROM ranked_rotating_duplicates WHERE rn > 1
);

-- Log the cleanup action
INSERT INTO task_generation_logs (
  family_id,
  window_start,
  window_end,
  inserted_count,
  skipped_count,
  error_message
) VALUES (
  'dbc515c9-220c-4084-ba1e-934456cc27e3',
  CURRENT_DATE,
  CURRENT_DATE,
  0,
  0,
  'Database cleanup completed - fixed variable scoping bug and reset watermarks'
);