-- First, temporarily drop the constraints to allow updates
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_task_group;
ALTER TABLE rotating_tasks DROP CONSTRAINT IF EXISTS valid_task_group;
ALTER TABLE task_series DROP CONSTRAINT IF EXISTS valid_task_group;

-- Update existing data from "afternoon" to "evening"
UPDATE tasks SET task_group = 'evening' WHERE task_group = 'afternoon';
UPDATE rotating_tasks SET task_group = 'evening' WHERE task_group = 'afternoon';
UPDATE task_series SET task_group = 'evening' WHERE task_group = 'afternoon';

-- Add new constraints that include 'evening' instead of 'afternoon'
ALTER TABLE tasks ADD CONSTRAINT valid_task_group 
  CHECK (task_group IN ('morning', 'midday', 'evening', 'general'));

ALTER TABLE rotating_tasks ADD CONSTRAINT valid_task_group 
  CHECK (task_group IN ('morning', 'midday', 'evening', 'general'));

ALTER TABLE task_series ADD CONSTRAINT valid_task_group 
  CHECK (task_group IN ('morning', 'midday', 'evening', 'general'));