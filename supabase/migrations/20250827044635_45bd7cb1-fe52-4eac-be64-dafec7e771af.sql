-- Add unique constraints after data cleanup
CREATE UNIQUE INDEX IF NOT EXISTS unique_series_due_date 
  ON tasks(series_id, due_date) 
  WHERE series_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_rotating_task_date 
  ON tasks(title, assigned_to, due_date) 
  WHERE task_group = 'rotating';