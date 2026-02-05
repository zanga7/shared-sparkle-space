-- Add rotate_on_completion column to rotating_tasks
-- When true: task rotates to next member immediately upon completion
-- When false: task follows the cadence schedule (daily/weekly/monthly)
ALTER TABLE public.rotating_tasks 
ADD COLUMN rotate_on_completion boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.rotating_tasks.rotate_on_completion IS 'When true, task rotates to next member immediately upon completion. When false, follows cadence schedule.';