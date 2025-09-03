-- Add task_group column to rotating_tasks table
ALTER TABLE public.rotating_tasks 
ADD COLUMN task_group text DEFAULT 'general';

-- Update existing rotating tasks to have 'general' as default
UPDATE public.rotating_tasks 
SET task_group = 'general' 
WHERE task_group IS NULL;