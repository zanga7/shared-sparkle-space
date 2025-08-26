-- Add completion_rule field to tasks table
ALTER TABLE public.tasks 
ADD COLUMN completion_rule text DEFAULT 'everyone' CHECK (completion_rule IN ('any_one', 'everyone'));

-- Update existing tasks to have the default completion rule
UPDATE public.tasks 
SET completion_rule = 'everyone' 
WHERE completion_rule IS NULL;