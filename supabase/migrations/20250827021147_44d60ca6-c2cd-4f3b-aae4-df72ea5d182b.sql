-- Remove legacy recurring fields from tasks table since we now use task_series
-- These fields are no longer needed as all recurring logic goes through task_series

ALTER TABLE tasks 
DROP COLUMN IF EXISTS recurring_frequency,
DROP COLUMN IF EXISTS recurring_interval, 
DROP COLUMN IF EXISTS recurring_days_of_week,
DROP COLUMN IF EXISTS recurring_end_date;