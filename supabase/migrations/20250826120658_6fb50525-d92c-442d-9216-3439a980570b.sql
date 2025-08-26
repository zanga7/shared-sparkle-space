-- Check the get_safe_calendar_integrations function
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'get_safe_calendar_integrations'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- This function acts like a view but is SECURITY DEFINER
-- The issue is that this function bypasses RLS by using SECURITY DEFINER
-- We need to replace this function with a proper approach

-- Drop the problematic function 
DROP FUNCTION IF EXISTS public.get_safe_calendar_integrations();

-- Replace with a function that properly respects user permissions
CREATE OR REPLACE FUNCTION public.get_user_calendar_integrations_metadata()
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  integration_type text,
  calendar_id text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  expires_at timestamp with time zone,
  last_token_refresh timestamp with time zone,
  token_refresh_count integer,
  created_ip inet,
  token_status text,
  refresh_token_status text,
  has_access_token boolean,
  has_refresh_token boolean,
  is_expired boolean,
  security_flags jsonb,
  last_access_ip inet
) 
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  user_profile_id UUID;
BEGIN
  -- Get current user's profile
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN QUERY
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at,
    ci.last_token_refresh,
    ci.token_refresh_count,
    ci.created_ip,
    -- Security status indicators without exposing tokens
    CASE 
      WHEN ci.access_token LIKE '%::%' THEN 'encrypted'::text
      WHEN ci.access_token LIKE 'SECURITY_REVOKED_%' THEN 'revoked_security'::text
      WHEN ci.access_token = 'REVOKED' THEN 'revoked'::text
      WHEN ci.access_token = 'PENDING_ENCRYPTION' THEN 'pending_encryption'::text
      ELSE 'unknown'::text
    END as token_status,
    
    CASE 
      WHEN ci.refresh_token LIKE '%::%' THEN 'encrypted'::text
      WHEN ci.refresh_token LIKE 'SECURITY_REVOKED_%' THEN 'revoked_security'::text
      WHEN ci.refresh_token = 'REVOKED' THEN 'revoked'::text
      WHEN ci.refresh_token = 'PENDING_ENCRYPTION' THEN 'pending_encryption'::text
      WHEN ci.refresh_token IS NULL THEN 'none'::text
      ELSE 'unknown'::text
    END as refresh_token_status,
    
    -- Safe boolean indicators
    (ci.access_token IS NOT NULL AND ci.access_token NOT LIKE '%REVOKED%') as has_access_token,
    (ci.refresh_token IS NOT NULL AND ci.refresh_token NOT LIKE '%REVOKED%') as has_refresh_token,
    (ci.expires_at IS NOT NULL AND ci.expires_at < now()) as is_expired,
    
    -- Security flags (safe metadata)
    ci.security_flags,
    ci.last_access_ip
  FROM public.calendar_integrations ci
  WHERE ci.profile_id = user_profile_id;
END;
$$;