-- Check for any remaining SECURITY DEFINER views
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition ILIKE '%security definer%';

-- Also check if there are any SECURITY DEFINER functions that might be causing the issue
SELECT n.nspname as "Schema",
       p.proname as "Name",
       pg_catalog.pg_get_function_result(p.oid) as "Result data type",
       CASE
         WHEN p.proisagg THEN 'agg'
         WHEN p.proiswindow THEN 'window'
         WHEN p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype THEN 'trigger'
         ELSE 'normal'
       END as "Type",
       p.prosecdef as "Security Definer"
FROM pg_catalog.pg_proc p
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true;