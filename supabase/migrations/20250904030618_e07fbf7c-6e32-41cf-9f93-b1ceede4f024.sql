-- Add recurrence_options column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN recurrence_options JSONB DEFAULT NULL;

-- Add recurrence_options column to events table  
ALTER TABLE public.events
ADD COLUMN recurrence_options JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.recurrence_options IS 'JSON data for task recurrence configuration';
COMMENT ON COLUMN public.events.recurrence_options IS 'JSON data for event recurrence configuration';