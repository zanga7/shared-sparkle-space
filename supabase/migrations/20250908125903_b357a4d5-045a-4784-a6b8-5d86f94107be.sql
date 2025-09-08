-- Add trigger to validate event dates on insert and update
CREATE OR REPLACE FUNCTION validate_event_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if end_date is before start_date
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Event end date (%) cannot be before start date (%)', 
      NEW.end_date, NEW.start_date;
  END IF;
  
  -- Check if dates are valid timestamps
  IF NEW.start_date IS NULL OR NEW.end_date IS NULL THEN
    RAISE EXCEPTION 'Event start_date and end_date cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for events table
DROP TRIGGER IF EXISTS validate_event_dates_trigger ON events;
CREATE TRIGGER validate_event_dates_trigger
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_event_dates();

-- Add similar validation for event_series table
DROP TRIGGER IF EXISTS validate_event_series_dates_trigger ON event_series;
CREATE TRIGGER validate_event_series_dates_trigger
  BEFORE INSERT OR UPDATE ON event_series
  FOR EACH ROW
  EXECUTE FUNCTION validate_event_dates();

-- Update existing invalid events to have valid date ranges
-- For events where end_date is before start_date, set end_date = start_date + 1 hour
UPDATE events 
SET end_date = start_date + INTERVAL '1 hour'
WHERE end_date < start_date;

-- Log the invalid events that were fixed
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM events 
  WHERE end_date < start_date;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE 'Fixed % events with invalid date ranges', fixed_count;
  END IF;
END $$;