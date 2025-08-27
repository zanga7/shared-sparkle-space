-- Remove all recurring and rotating task functionality

-- Drop tables related to recurring/rotating tasks
DROP TABLE IF EXISTS task_generation_logs CASCADE;
DROP TABLE IF EXISTS rotating_tasks CASCADE;
DROP TABLE IF EXISTS task_series CASCADE;

-- Remove recurring-related columns from tasks table
ALTER TABLE tasks DROP COLUMN IF EXISTS is_repeating;
ALTER TABLE tasks DROP COLUMN IF EXISTS series_id;

-- Clean up any existing recurring task data
DELETE FROM tasks WHERE task_group = 'rotating';