-- Let's see the specific SECURITY DEFINER functions
SELECT proname, prosrc 
FROM pg_proc 
WHERE prosecdef = true 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 5;

-- The linter might be detecting SECURITY DEFINER functions that create views
-- Let's check if any functions create views with SECURITY DEFINER
-- Look for any function that might be creating problematic views
SELECT 
    proname as function_name,
    prosecdef as is_security_definer,
    CASE 
        WHEN prosrc ILIKE '%create view%' AND prosrc ILIKE '%security definer%' THEN 'CREATES_SECURITY_DEFINER_VIEW'
        WHEN prosrc ILIKE '%create view%' THEN 'CREATES_VIEW'
        ELSE 'NORMAL_FUNCTION'
    END as view_creation_status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND prosecdef = true;