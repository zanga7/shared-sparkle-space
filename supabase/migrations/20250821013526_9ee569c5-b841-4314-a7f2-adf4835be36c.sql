-- Fix the security definer view issue by removing the SECURITY DEFINER property
-- The view is fine as-is since it has proper RLS policies in place

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.calendar_security_summary;

CREATE OR REPLACE VIEW public.calendar_security_summary AS
SELECT 
  ci.id,
  ci.integration_type,
  ci.is_active,
  p.display_name as owner_name,
  ci.created_at,
  ci.last_token_refresh,
  ci.token_refresh_count,
  (
    SELECT COUNT(*) 
    FROM public.calendar_token_audit cta 
    WHERE cta.integration_id = ci.id 
    AND cta.created_at > now() - INTERVAL '7 days'
  ) as access_count_7_days,
  (
    SELECT COUNT(*) 
    FROM public.calendar_token_audit cta 
    WHERE cta.integration_id = ci.id 
    AND cta.success = false
    AND cta.created_at > now() - INTERVAL '7 days'
  ) as failed_access_count_7_days
FROM public.calendar_integrations ci
JOIN public.profiles p ON p.id = ci.profile_id
WHERE EXISTS (
  SELECT 1 
  FROM public.profiles admin_p 
  WHERE admin_p.user_id = auth.uid() 
  AND admin_p.role = 'parent'
  AND admin_p.family_id = p.family_id
);

-- Add an RLS policy to the view (views inherit RLS from their base tables anyway)
-- But this makes the security intent clear
COMMENT ON VIEW public.calendar_security_summary IS 
'Security monitoring view for calendar integrations. Only accessible to parent users within same family.';