-- Fix security definer view issue
-- Remove the security_barrier setting which is causing the warning
DROP VIEW IF EXISTS public.calendar_integrations_secure;

-- Recreate the view without security_barrier (use functions for security instead)
CREATE OR REPLACE VIEW public.calendar_integrations_secure AS
SELECT 
  id,
  profile_id,
  integration_type,
  calendar_id,
  is_active,
  created_at,
  updated_at,
  expires_at,
  last_token_refresh,
  token_refresh_count,
  created_ip,
  last_access_ip,
  security_flags,
  -- Show masked token indicators instead of raw tokens
  CASE 
    WHEN access_token IS NOT NULL THEN 'ENCRYPTED_TOKEN_SET'
    ELSE NULL 
  END as access_token_status,
  CASE 
    WHEN refresh_token IS NOT NULL THEN 'ENCRYPTED_TOKEN_SET'
    ELSE NULL 
  END as refresh_token_status,
  -- Token expiration status
  CASE 
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN true
    ELSE false
  END as is_token_expired
FROM public.calendar_integrations;

-- Add RLS to the view
ALTER VIEW public.calendar_integrations_secure ENABLE ROW LEVEL SECURITY;

-- Create policy for the view that uses the security function
CREATE POLICY "Secure calendar integration view access" 
ON public.calendar_integrations_secure
FOR SELECT 
USING (public.can_access_calendar_integration(profile_id));