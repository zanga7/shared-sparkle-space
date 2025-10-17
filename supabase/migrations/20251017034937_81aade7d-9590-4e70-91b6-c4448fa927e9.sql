-- Update sync_series_end to use end-of-day calculation
-- This prevents "end before start" errors when splitting on first occurrence

CREATE OR REPLACE FUNCTION public.sync_series_end()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sync series_end based on recurrence_rule->>'endType'
  IF NEW.recurrence_rule->>'endType' = 'on_date' THEN
    -- Extract endDate from recurrence_rule and set series_end to END of that day
    -- This ensures series_end is never before series_start even if they're on the same day
    NEW.series_end = (
      (NEW.recurrence_rule->>'endDate')::date + interval '1 day' - interval '1 second'
    )::timestamptz;
  ELSIF NEW.recurrence_rule->>'endType' = 'never' OR NEW.recurrence_rule->>'endType' = 'after_count' THEN
    -- Clear series_end for 'never' and 'after_count' (since end is computed, not a fixed date)
    NEW.series_end = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;