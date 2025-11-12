-- Update the task_group constraint to allow 'afternoon' as a valid value
-- Drop the existing constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_task_group;

-- Add the updated constraint with afternoon included
ALTER TABLE tasks ADD CONSTRAINT valid_task_group 
CHECK (task_group IN ('morning', 'midday', 'afternoon', 'evening', 'general'));

-- Also update task_series constraint
ALTER TABLE task_series DROP CONSTRAINT IF EXISTS valid_task_group;
ALTER TABLE task_series ADD CONSTRAINT valid_task_group 
CHECK (task_group IN ('morning', 'midday', 'afternoon', 'evening', 'general'));

-- Also update rotating_tasks constraint if it exists
ALTER TABLE rotating_tasks DROP CONSTRAINT IF EXISTS valid_task_group;
ALTER TABLE rotating_tasks ADD CONSTRAINT valid_task_group 
CHECK (task_group IN ('morning', 'midday', 'afternoon', 'evening', 'general'));