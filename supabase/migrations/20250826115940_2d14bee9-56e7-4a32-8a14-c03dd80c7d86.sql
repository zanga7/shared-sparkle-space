-- Find SECURITY DEFINER functions
SELECT 
    n.nspname as "Schema",
    p.proname as "Name",
    p.prosecdef as "Security Definer"
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true;

-- The issue is likely with SECURITY DEFINER functions, not views
-- Based on the linter error, we need to identify which views have SECURITY DEFINER
-- Let's check view definitions more carefully
SELECT 
    schemaname, 
    viewname, 
    CASE 
        WHEN definition ILIKE '%security definer%' THEN 'HAS_SECURITY_DEFINER'
        ELSE 'NORMAL'
    END as security_status
FROM pg_views 
WHERE schemaname = 'public';