-- Fix the function search path security issue for the new function
CREATE OR REPLACE FUNCTION public.validate_event_series_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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