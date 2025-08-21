-- Fix the security definer view issue
-- Replace the view with a regular view and use RLS instead

-- Drop the existing view
DROP VIEW IF EXISTS public.calendar_security_summary;

-- Create a regular view (not security definer) for security monitoring
-- The RLS policies will handle access control
CREATE VIEW public.calendar_security_summary AS
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
JOIN public.profiles p ON p.id = ci.profile_id;

-- Enable RLS on the view's underlying tables (already enabled)
-- Create a function to check if user is a parent in the same family
CREATE OR REPLACE FUNCTION public.is_parent_in_same_family(target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles admin_p
    JOIN public.profiles target_p ON target_p.id = target_profile_id
    WHERE admin_p.user_id = auth.uid() 
    AND admin_p.role = 'parent'
    AND admin_p.family_id = target_p.family_id
  );
END;
$$;

-- The view access will be controlled by the underlying table RLS policies
-- which already ensure users can only see their own family's data

-- Update documentation
COMMENT ON VIEW public.calendar_security_summary IS 
'Security monitoring view for calendar integrations. Access controlled by RLS policies on underlying tables.';

-- Add additional security function for monitoring
CREATE OR REPLACE FUNCTION public.get_calendar_security_alerts(family_id_param UUID DEFAULT NULL)
RETURNS TABLE(
  alert_type TEXT,
  alert_message TEXT,
  integration_id UUID,
  severity TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get user's family ID
  SELECT p.family_id INTO user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  -- Only parents can view security alerts
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only parents can view security alerts';
  END IF;

  -- Use provided family_id or user's family_id
  user_family_id := COALESCE(family_id_param, user_family_id);

  -- Return security alerts
  RETURN QUERY
  SELECT 
    'failed_access'::TEXT as alert_type,
    'Failed calendar token access attempt'::TEXT as alert_message,
    cta.integration_id,
    'HIGH'::TEXT as severity,
    cta.created_at
  FROM public.calendar_token_audit cta
  JOIN public.calendar_integrations ci ON ci.id = cta.integration_id
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
    AND cta.success = false
    AND cta.created_at > now() - INTERVAL '30 days'
  
  UNION ALL
  
  SELECT 
    'high_refresh_rate'::TEXT as alert_type,
    'Unusually high token refresh rate detected'::TEXT as alert_message,
    ci.id as integration_id,
    'MEDIUM'::TEXT as severity,
    ci.last_token_refresh as created_at
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
    AND ci.token_refresh_count > 50 -- Alert if more than 50 refreshes
    AND ci.last_token_refresh > now() - INTERVAL '7 days'
  
  ORDER BY created_at DESC;
END;
$$;