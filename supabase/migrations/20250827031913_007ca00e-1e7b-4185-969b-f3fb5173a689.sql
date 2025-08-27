-- Remove the old recurring task generation edge function trigger
-- and replace with a simpler approach

-- Drop the trigger that calls the edge function
DROP TRIGGER IF EXISTS trigger_generate_recurring_tasks ON task_series;

-- Create a simple function to calculate next due date for a series
CREATE OR REPLACE FUNCTION calculate_next_due_date(series task_series)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
  next_date TIMESTAMP WITH TIME ZONE;
  start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Use start_date if available, otherwise use created_at
  start_date := COALESCE(series.start_date, series.created_at);
  
  -- Use last_generated_date if available, otherwise start from start_date
  next_date := COALESCE(series.last_generated_date, start_date);
  
  -- Calculate next occurrence based on frequency
  CASE series.recurring_frequency
    WHEN 'daily' THEN
      next_date := next_date + (series.recurring_interval || ' days')::INTERVAL;
    WHEN 'weekly' THEN
      next_date := next_date + (series.recurring_interval * 7 || ' days')::INTERVAL;
    WHEN 'monthly' THEN
      next_date := next_date + (series.recurring_interval || ' months')::INTERVAL;
    WHEN 'yearly' THEN
      next_date := next_date + (series.recurring_interval || ' years')::INTERVAL;
    ELSE
      -- Default to daily if unknown frequency
      next_date := next_date + '1 day'::INTERVAL;
  END CASE;
  
  RETURN next_date;
END;
$$;

-- Update task_series table to set next_due_date for existing series
UPDATE task_series 
SET next_due_date = calculate_next_due_date(task_series.*)
WHERE next_due_date IS NULL AND is_active = true;

-- Add a simple trigger to update next_due_date when series is created/updated
CREATE OR REPLACE FUNCTION update_task_series_next_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate next due date on insert or update
  NEW.next_due_date := calculate_next_due_date(NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_task_series_next_due_date
  BEFORE INSERT OR UPDATE ON task_series
  FOR EACH ROW
  EXECUTE FUNCTION update_task_series_next_due_date();

-- Add index for better performance on recurring task queries
CREATE INDEX IF NOT EXISTS idx_tasks_series_id_due_date ON tasks(series_id, due_date) WHERE series_id IS NOT NULL;