-- Fix mutable search_path in trigger functions
-- These are SECURITY INVOKER functions but should still have search_path set for safety

-- Fix update_task_series_next_due_date
CREATE OR REPLACE FUNCTION public.update_task_series_next_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Calculate next due date on insert or update
  NEW.next_due_date := calculate_next_due_date(NEW);
  RETURN NEW;
END;
$function$;

-- Fix validate_event_dates
CREATE OR REPLACE FUNCTION public.validate_event_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

-- Fix validate_parent_role_change
CREATE OR REPLACE FUNCTION public.validate_parent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Allow the role change, but warn if parent doesn't have user_id
  -- The application should handle creating auth accounts for new parents
  RETURN NEW;
END;
$function$;