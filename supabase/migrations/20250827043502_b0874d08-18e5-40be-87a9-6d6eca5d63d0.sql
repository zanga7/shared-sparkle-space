-- Phase 1: Emergency Data Cleanup & Safety (Fixed)

-- Add watermark field to track generation progress
ALTER TABLE task_series ADD COLUMN IF NOT EXISTS last_generated_through DATE;

-- Add check constraint for valid task_group values (fixed existing constraint issues)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_task_group;
ALTER TABLE tasks ADD CONSTRAINT valid_task_group 
  CHECK (task_group IN ('general', 'recurring', 'rotating', 'chores', 'homework', 'projects'));

-- Add critical indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_family_due_date 
  ON tasks(family_id, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_series_due_date 
  ON tasks(series_id, due_date) 
  WHERE series_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_series_active_family 
  ON task_series(family_id) 
  WHERE is_active = true;

-- Add generation logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS task_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  series_id UUID REFERENCES task_series(id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  inserted_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for generation logs
CREATE INDEX IF NOT EXISTS idx_generation_logs_family_date 
  ON task_generation_logs(family_id, created_at);

-- Clean up existing duplicate tasks (keep the earliest created)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY family_id, title, due_date::date, COALESCE(assigned_to, '')
      ORDER BY created_at ASC
    ) as rn
  FROM tasks
  WHERE due_date IS NOT NULL
)
DELETE FROM tasks 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraints last (after cleanup)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_series_due_date 
  ON tasks(series_id, due_date) 
  WHERE series_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_rotating_task_date 
  ON tasks(title, assigned_to, due_date) 
  WHERE task_group = 'rotating';