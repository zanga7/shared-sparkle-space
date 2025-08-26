-- The linter is still detecting a Security Definer View issue
-- Let's completely remove the view approach and rely only on secure functions

-- Drop the view entirely 
DROP VIEW IF EXISTS public.calendar_integrations_safe CASCADE;

-- Verify no views with SECURITY DEFINER exist
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public';

-- Based on the Supabase docs, the issue might be that views created by SECURITY DEFINER functions
-- are detected as "Security Definer Views". Since we have many SECURITY DEFINER functions,
-- the linter might be flagging this as an issue.

-- Let's check if we have any view-like constructs that might be problematic
-- by examining materialized views too
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE schemaname = 'public';