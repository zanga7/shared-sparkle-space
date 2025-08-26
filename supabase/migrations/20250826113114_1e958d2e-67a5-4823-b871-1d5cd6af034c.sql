-- Add task_group column to tasks table for organizing tasks by time periods
ALTER TABLE public.tasks 
ADD COLUMN task_group text DEFAULT 'general';

-- Add index for better performance on task_group queries
CREATE INDEX idx_tasks_task_group ON public.tasks(task_group);

-- Add check constraint to ensure valid task groups
ALTER TABLE public.tasks 
ADD CONSTRAINT valid_task_group 
CHECK (task_group IN ('morning', 'midday', 'afternoon', 'general'));