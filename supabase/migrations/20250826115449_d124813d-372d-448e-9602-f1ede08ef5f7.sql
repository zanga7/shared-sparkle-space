-- Fix the security definer view issue by recreating views without SECURITY DEFINER

-- Drop the existing view
DROP VIEW IF EXISTS public.calendar_integrations_safe;

-- Create a secure view without SECURITY DEFINER that relies on base table RLS
CREATE VIEW public.calendar_integrations_safe AS
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
WHERE EXISTS (
  SELECT 1 
  FROM public.profiles p
  WHERE p.id = ci.profile_id 
  AND p.user_id = auth.uid()
);

-- Set security barrier to ensure RLS is properly enforced
ALTER VIEW public.calendar_integrations_safe SET (security_barrier = true);