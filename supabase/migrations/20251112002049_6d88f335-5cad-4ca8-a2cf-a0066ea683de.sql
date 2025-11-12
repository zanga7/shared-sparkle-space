-- Final cleanup: Update all 'afternoon' task_group values to 'evening'
-- This ensures consistency across all tables before edge functions are fixed

-- Update tasks table
UPDATE tasks 
SET task_group = 'evening' 
WHERE task_group = 'afternoon';

-- Update task_series table
UPDATE task_series 
SET task_group = 'evening' 
WHERE task_group = 'afternoon';

-- Update rotating_tasks table if it exists
UPDATE rotating_tasks 
SET task_group = 'evening' 
WHERE task_group = 'afternoon';

-- Verify the constraint is in place (should already exist)
-- The constraint valid_task_group should only allow: morning, midday, evening, general