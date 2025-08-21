-- Fix the search path security issues for the functions created
CREATE OR REPLACE FUNCTION public.is_calendar_integration_owner(integration_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = integration_id 
    AND p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_calendar_integration_safe(integration_id UUID)
RETURNS TABLE(
  id UUID,
  profile_id UUID,
  integration_type TEXT,
  calendar_id TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id 
  AND p.user_id = auth.uid();
$$;