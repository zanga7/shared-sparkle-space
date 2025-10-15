-- Phase 1: Add RRULE support and fix series_end synchronization

-- Step 1: Add rrule column to event_series table
ALTER TABLE public.event_series 
ADD COLUMN IF NOT EXISTS rrule TEXT;

-- Step 2: Add rrule column to task_series table
ALTER TABLE public.task_series 
ADD COLUMN IF NOT EXISTS rrule TEXT;

-- Step 3: Create function to keep series_end in sync with recurrence_rule
CREATE OR REPLACE FUNCTION public.sync_series_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync series_end based on recurrence_rule->>'endType'
  IF NEW.recurrence_rule->>'endType' = 'on_date' THEN
    -- Extract endDate from recurrence_rule and set as series_end
    NEW.series_end = (NEW.recurrence_rule->>'endDate')::timestamptz;
  ELSIF NEW.recurrence_rule->>'endType' = 'never' OR NEW.recurrence_rule->>'endType' = 'after_count' THEN
    -- Clear series_end for 'never' and 'after_count' (since end is computed, not a fixed date)
    NEW.series_end = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Apply trigger to event_series table
DROP TRIGGER IF EXISTS sync_event_series_end_trigger ON public.event_series;
CREATE TRIGGER sync_event_series_end_trigger
BEFORE INSERT OR UPDATE ON public.event_series
FOR EACH ROW
EXECUTE FUNCTION public.sync_series_end();

-- Step 5: Apply trigger to task_series table
DROP TRIGGER IF EXISTS sync_task_series_end_trigger ON public.task_series;
CREATE TRIGGER sync_task_series_end_trigger
BEFORE INSERT OR UPDATE ON public.task_series
FOR EACH ROW
EXECUTE FUNCTION public.sync_series_end();

-- Step 6: Add comments for documentation
COMMENT ON COLUMN public.event_series.rrule IS 'RFC 5545 compliant RRULE string for calendar integration (e.g., Google Calendar, Outlook)';
COMMENT ON COLUMN public.task_series.rrule IS 'RFC 5545 compliant RRULE string for calendar integration (e.g., Google Calendar, Outlook)';
COMMENT ON FUNCTION public.sync_series_end() IS 'Automatically synchronizes series_end with recurrence_rule endType to prevent state inconsistencies';