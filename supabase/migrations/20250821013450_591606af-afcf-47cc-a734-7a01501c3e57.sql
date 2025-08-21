-- Create enhanced security features for calendar tokens
-- Skip policies that already exist

-- Create audit logging for calendar token access (if not exists)
CREATE TABLE IF NOT EXISTS public.calendar_token_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('access', 'refresh', 'revoke', 'create')),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on audit table (if not already enabled)
ALTER TABLE public.calendar_token_audit ENABLE ROW LEVEL SECURITY;

-- Function to log calendar token access
CREATE OR REPLACE FUNCTION public.log_calendar_token_access(
  p_integration_id UUID,
  p_action TEXT,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.calendar_token_audit (
    integration_id,
    user_id,
    action,
    success,
    error_message
  ) VALUES (
    p_integration_id,
    auth.uid(),
    p_action,
    p_success,
    p_error_message
  );
END;
$$;

-- Create a secure function to get calendar tokens for API use only
-- This should ONLY be called by edge functions, never by client code
CREATE OR REPLACE FUNCTION public.get_calendar_token_for_api(
  integration_id UUID,
  requesting_function TEXT DEFAULT 'unknown'
)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  token_record RECORD;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  -- Validate access using existing function
  IF NOT public.is_calendar_integration_owner(integration_id) THEN
    -- Log unauthorized access attempt
    PERFORM public.log_calendar_token_access(
      integration_id, 
      'access', 
      false, 
      'Unauthorized access attempt by function: ' || requesting_function
    );
    
    RAISE EXCEPTION 'Access denied to calendar integration';
  END IF;

  -- Get the token
  SELECT ci.access_token, ci.refresh_token, ci.expires_at
  INTO token_record
  FROM public.calendar_integrations ci
  WHERE ci.id = integration_id;

  -- Log successful access
  PERFORM public.log_calendar_token_access(integration_id, 'access', true);

  -- Return the token data
  RETURN QUERY SELECT 
    token_record.access_token,
    token_record.refresh_token,
    token_record.expires_at;
END;
$$;

-- Add additional security constraints
-- Limit token refresh frequency to prevent abuse
ALTER TABLE public.calendar_integrations 
ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS token_refresh_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_ip INET,
ADD COLUMN IF NOT EXISTS last_access_ip INET,
ADD COLUMN IF NOT EXISTS security_flags JSONB DEFAULT '{}';

-- Add trigger to update refresh tracking
CREATE OR REPLACE FUNCTION public.track_token_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If access_token changed, track the refresh
  IF OLD.access_token IS DISTINCT FROM NEW.access_token THEN
    NEW.last_token_refresh = now();
    NEW.token_refresh_count = COALESCE(OLD.token_refresh_count, 0) + 1;
    
    -- Log the refresh
    PERFORM public.log_calendar_token_access(NEW.id, 'refresh', true);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger (replace if exists)
DROP TRIGGER IF EXISTS track_calendar_token_refresh ON public.calendar_integrations;
CREATE TRIGGER track_calendar_token_refresh
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.track_token_refresh();

-- Add rate limiting for token access
CREATE OR REPLACE FUNCTION public.check_token_access_rate_limit(
  integration_id UUID,
  max_requests INTEGER DEFAULT 100,
  time_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
BEGIN
  -- Count recent access attempts
  SELECT COUNT(*)
  INTO request_count
  FROM public.calendar_token_audit
  WHERE integration_id = check_token_access_rate_limit.integration_id
    AND created_at > now() - (time_window_minutes || ' minutes')::INTERVAL
    AND action = 'access';
    
  RETURN request_count < max_requests;
END;
$$;

-- Create view for security monitoring (parents only)
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

-- Enhanced security documentation
COMMENT ON FUNCTION public.get_calendar_token_for_api(UUID, TEXT) IS 
'SECURITY CRITICAL: This function returns calendar OAuth tokens and should ONLY be called by authenticated edge functions. Never expose to client-side code.';

COMMENT ON TABLE public.calendar_token_audit IS 
'Security audit log for calendar token access. Tracks all access, refresh, and revocation events for compliance and security monitoring.';

COMMENT ON COLUMN public.calendar_integrations.access_token IS 
'OAuth access token - HIGHLY SENSITIVE. Should be encrypted at rest and only accessible via secure functions. Never log or expose in client code.';

COMMENT ON COLUMN public.calendar_integrations.refresh_token IS 
'OAuth refresh token - HIGHLY SENSITIVE. Should be encrypted at rest and only accessible via secure functions. Never log or expose in client code.';

COMMENT ON COLUMN public.calendar_integrations.security_flags IS 
'Security metadata for tracking token status, anomalies, and security events.';

COMMENT ON COLUMN public.calendar_integrations.token_refresh_count IS 
'Counter for token refresh operations - helps detect abnormal refresh patterns that could indicate compromise.';

-- Create function to revoke calendar tokens securely
CREATE OR REPLACE FUNCTION public.revoke_calendar_integration(
  integration_id UUID,
  reason TEXT DEFAULT 'user_requested'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  integration_exists BOOLEAN;
BEGIN
  -- Validate ownership
  IF NOT public.is_calendar_integration_owner(integration_id) THEN
    PERFORM public.log_calendar_token_access(
      integration_id, 
      'revoke', 
      false, 
      'Unauthorized revocation attempt'
    );
    RAISE EXCEPTION 'Access denied to calendar integration';
  END IF;

  -- Mark as inactive and clear tokens
  UPDATE public.calendar_integrations 
  SET 
    is_active = false,
    access_token = 'REVOKED',
    refresh_token = 'REVOKED',
    security_flags = jsonb_build_object(
      'revoked_at', now(),
      'revoked_reason', reason,
      'revoked_by', auth.uid()
    )
  WHERE id = integration_id;

  GET DIAGNOSTICS integration_exists = ROW_COUNT;

  -- Log the revocation
  PERFORM public.log_calendar_token_access(
    integration_id, 
    'revoke', 
    integration_exists > 0,
    CASE WHEN integration_exists > 0 THEN NULL ELSE 'Integration not found' END
  );

  RETURN integration_exists > 0;
END;
$$;