-- Add new fields to task_series table for enhanced recurring options
ALTER TABLE public.task_series 
ADD COLUMN start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN repetition_count INTEGER,
ADD COLUMN remaining_repetitions INTEGER,
ADD COLUMN monthly_type TEXT CHECK (monthly_type IN ('date', 'weekday')),
ADD COLUMN monthly_weekday_ordinal INTEGER CHECK (monthly_weekday_ordinal IN (1, 2, 3, 4, -1)),
ADD COLUMN skip_next_occurrence BOOLEAN DEFAULT false;

-- Add yearly frequency support by updating the frequency check if it exists
-- (We'll handle this in the application logic since there's no constraint to update)

-- Update existing records to have proper default values
UPDATE public.task_series 
SET 
  start_date = created_at,
  monthly_type = 'date'
WHERE start_date IS NULL;