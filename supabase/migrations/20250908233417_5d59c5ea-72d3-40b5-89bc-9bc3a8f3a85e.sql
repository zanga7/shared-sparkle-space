-- Create a new validation function specifically for event_series table
CREATE OR REPLACE FUNCTION public.validate_event_series_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check if series_end is before series_start (only if series_end is not null)
  IF NEW.series_end IS NOT NULL AND NEW.series_end < NEW.series_start THEN
    RAISE EXCEPTION 'Event series end date (%) cannot be before start date (%)', 
      NEW.series_end, NEW.series_start;
  END IF;
  
  -- Check if series_start is valid timestamp
  IF NEW.series_start IS NULL THEN
    RAISE EXCEPTION 'Event series_start cannot be null';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop the existing incorrect trigger
DROP TRIGGER IF EXISTS validate_event_series_dates_trigger ON public.event_series;

-- Create the correct trigger for event_series table
CREATE TRIGGER validate_event_series_dates_trigger
  BEFORE INSERT OR UPDATE ON public.event_series
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_event_series_dates();