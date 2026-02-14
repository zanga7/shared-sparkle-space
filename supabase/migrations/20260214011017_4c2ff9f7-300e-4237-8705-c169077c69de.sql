
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule hourly cleanup of completed tasks
SELECT cron.schedule(
  'cleanup-completed-tasks-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://timefstlnqojqidllokb.supabase.co/functions/v1/cleanup-completed-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
