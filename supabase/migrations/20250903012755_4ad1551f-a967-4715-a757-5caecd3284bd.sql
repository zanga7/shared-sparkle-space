-- Update the check constraint to include time-based task groups
ALTER TABLE public.tasks 
DROP CONSTRAINT valid_task_group;

ALTER TABLE public.tasks 
ADD CONSTRAINT valid_task_group 
CHECK (task_group = ANY (ARRAY['general'::text, 'recurring'::text, 'rotating'::text, 'chores'::text, 'homework'::text, 'projects'::text, 'morning'::text, 'midday'::text, 'afternoon'::text]));