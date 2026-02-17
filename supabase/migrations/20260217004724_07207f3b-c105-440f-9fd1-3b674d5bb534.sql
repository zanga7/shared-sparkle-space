
-- Enable pg_cron and pg_net extensions (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule hourly fallback calendar sync
SELECT cron.schedule(
  'sync-all-calendars-hourly',
  '0 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://timefstlnqojqidllokb.supabase.co/functions/v1/sync-all-calendars',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbWVmc3RsbnFvanFpZGxsb2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTM5MTEsImV4cCI6MjA3MDQ4OTkxMX0.PkLLAvSWoK_UaBK5IltQ2hKMCMg1yoXZtSAh65pXXq4"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
