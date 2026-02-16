-- Remove the broken cron job
SELECT cron.unschedule('cleanup-completed-tasks-hourly');

-- Create a wrapper function that cleans up all families
CREATE OR REPLACE FUNCTION public.cleanup_all_completed_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family RECORD;
  v_result json;
BEGIN
  FOR v_family IN SELECT id FROM public.families LOOP
    v_result := public.hide_completed_tasks(v_family.id);
  END LOOP;
END;
$$;

-- Schedule hourly cleanup that calls the wrapper function directly
SELECT cron.schedule(
  'cleanup-completed-tasks-hourly',
  '0 * * * *',
  'SELECT public.cleanup_all_completed_tasks()'
);