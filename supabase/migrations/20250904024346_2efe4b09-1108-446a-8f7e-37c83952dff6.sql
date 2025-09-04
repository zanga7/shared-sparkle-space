-- Security Fix: Final Database Function Hardening
-- Fix all remaining SQL functions that need search_path security

-- Update all remaining SQL functions to have proper search_path
CREATE OR REPLACE FUNCTION public.can_access_calendar_integration(integration_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile_id UUID;
  integration_family_id UUID;
  user_family_id UUID;
BEGIN
  -- Get current user's profile
  SELECT id, family_id INTO user_profile_id, user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get integration's family
  SELECT family_id INTO integration_family_id
  FROM public.profiles 
  WHERE id = integration_profile_id;
  
  -- Allow access if same family
  RETURN user_family_id = integration_family_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_calendar_integration_owner(integration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = integration_id 
    AND p.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_calendar_integration_safe(integration_id uuid)
RETURNS TABLE(id uuid, profile_id uuid, integration_type text, calendar_id text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.validate_calendar_token_access(integration_id uuid, requesting_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = integration_id 
    AND p.user_id = requesting_user_id
  );
END;
$function$;