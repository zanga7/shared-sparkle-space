-- Clean up duplicate tasks more thoroughly
WITH ranked_duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY series_id, due_date 
      ORDER BY created_at ASC
    ) as rn
  FROM tasks
  WHERE series_id IS NOT NULL
)
DELETE FROM tasks 
WHERE id IN (
  SELECT id FROM ranked_duplicates WHERE rn > 1
);

-- Clean up rotating task duplicates
WITH ranked_rotating AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, assigned_to, due_date 
      ORDER BY created_at ASC
    ) as rn
  FROM tasks
  WHERE task_group = 'rotating'
)
DELETE FROM tasks 
WHERE id IN (
  SELECT id FROM ranked_rotating WHERE rn > 1
);

-- Now add the unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS unique_series_due_date 
  ON tasks(series_id, due_date) 
  WHERE series_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_rotating_task_date 
  ON tasks(title, assigned_to, due_date) 
  WHERE task_group = 'rotating';