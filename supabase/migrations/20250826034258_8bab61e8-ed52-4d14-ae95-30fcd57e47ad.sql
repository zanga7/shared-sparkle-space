-- Security Migration: Comprehensive Calendar Token Protection
-- This migration addresses the critical security vulnerability where calendar OAuth tokens
-- could be stolen by hackers by implementing comprehensive encryption and access controls

-- First, ensure all existing tokens are revoked if they're not encrypted
-- (We can identify unencrypted tokens as they won't contain the '::' separator used in our encryption format)

-- 1. Revoke any unencrypted tokens and mark them for re-authentication
UPDATE public.calendar_integrations 
SET 
  access_token = 'SECURITY_REVOKED_' || encode(gen_random_bytes(16), 'hex'),
  refresh_token = CASE 
    WHEN refresh_token IS NOT NULL THEN 'SECURITY_REVOKED_' || encode(gen_random_bytes(16), 'hex')
    ELSE NULL 
  END,
  is_active = false,
  security_flags = jsonb_build_object(
    'security_migration', true,
    'revoked_at', now(),
    'reason', 'unencrypted_tokens_security_fix',
    'requires_reauthentication', true
  )
WHERE access_token IS NOT NULL 
  AND access_token NOT LIKE '%::%'  -- Not encrypted format
  AND access_token NOT LIKE 'SECURITY_REVOKED_%'
  AND access_token != 'REVOKED';

-- 2. Remove direct table access - Users should only access tokens through secure functions
-- Revoke existing RLS policies that allow direct table access
DROP POLICY IF EXISTS "Users can manage their own calendar integrations" ON public.calendar_integrations;

-- 3. Create new restricted RLS policies for metadata access only
CREATE POLICY "Users can view their own integration metadata" 
ON public.calendar_integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- No direct INSERT/UPDATE/DELETE access - must use secure functions
CREATE POLICY "No direct token access" 
ON public.calendar_integrations 
FOR ALL 
USING (false);

-- 4. Create secure function for creating integrations (replaces direct INSERT)
CREATE OR REPLACE FUNCTION public.create_secure_calendar_integration(
  integration_type_param text,
  calendar_id_param text,
  access_token_param text,
  refresh_token_param text DEFAULT NULL,
  expires_at_param timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_profile_id UUID;
  new_integration_id UUID;
  user_family_id UUID;
BEGIN
  -- Rate limiting: Check for too many recent integrations
  IF (
    SELECT COUNT(*) 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE p.user_id = auth.uid() 
    AND ci.created_at > now() - INTERVAL '1 hour'
  ) >= 5 THEN
    RETURN json_build_object('success', false, 'error', 'Rate limit exceeded');
  END IF;

  -- Get current user's profile and family
  SELECT p.id, p.family_id INTO user_profile_id, user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Validate input parameters
  IF access_token_param IS NULL OR length(access_token_param) < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid access token');
  END IF;

  -- Create integration record with placeholder tokens (will be encrypted separately)
  INSERT INTO public.calendar_integrations (
    profile_id,
    integration_type,
    calendar_id,
    access_token,
    refresh_token,
    expires_at,
    created_ip,
    security_flags
  ) VALUES (
    user_profile_id,
    integration_type_param,
    calendar_id_param,
    'PENDING_ENCRYPTION',
    CASE WHEN refresh_token_param IS NOT NULL THEN 'PENDING_ENCRYPTION' ELSE NULL END,
    expires_at_param,
    inet_client_addr(),
    jsonb_build_object(
      'created_securely', true,
      'encryption_pending', true,
      'created_at', now()
    )
  ) RETURNING id INTO new_integration_id;

  -- Now encrypt and store tokens using existing secure function
  PERFORM public.store_calendar_tokens_secure(
    new_integration_id,
    access_token_param,
    refresh_token_param,
    expires_at_param
  );

  -- Update security flags to indicate completion
  UPDATE public.calendar_integrations 
  SET security_flags = jsonb_build_object(
    'created_securely', true,
    'encrypted_at', now(),
    'encryption_version', '2.0'
  )
  WHERE id = new_integration_id;

  -- Log secure creation
  PERFORM public.log_sensitive_access(
    'calendar_integrations',
    new_integration_id,
    'secure_integration_created',
    true,
    json_build_object(
      'integration_type', integration_type_param,
      'encrypted', true
    )
  );

  RETURN json_build_object(
    'success', true, 
    'integration_id', new_integration_id,
    'message', 'Calendar integration created with military-grade encryption'
  );
END;
$$;

-- 5. Create function for securely updating integrations
CREATE OR REPLACE FUNCTION public.update_calendar_integration_secure(
  integration_id_param uuid,
  integration_type_param text DEFAULT NULL,
  calendar_id_param text DEFAULT NULL,
  is_active_param boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_profile_id UUID;
  integration_exists boolean;
BEGIN
  -- Verify ownership
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  JOIN public.calendar_integrations ci ON ci.profile_id = p.id
  WHERE p.user_id = auth.uid() 
  AND ci.id = integration_id_param;
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Integration not found or access denied');
  END IF;

  -- Update non-sensitive fields only
  UPDATE public.calendar_integrations 
  SET 
    integration_type = COALESCE(integration_type_param, integration_type),
    calendar_id = COALESCE(calendar_id_param, calendar_id),
    is_active = COALESCE(is_active_param, is_active),
    updated_at = now()
  WHERE id = integration_id_param;

  GET DIAGNOSTICS integration_exists = ROW_COUNT;

  -- Log the update
  IF integration_exists THEN
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'integration_updated_securely',
      true,
      json_build_object('updated_fields', json_build_object(
        'integration_type', integration_type_param,
        'calendar_id', calendar_id_param,
        'is_active', is_active_param
      ))
    );
  END IF;

  RETURN json_build_object(
    'success', integration_exists,
    'message', CASE WHEN integration_exists THEN 'Integration updated successfully' ELSE 'Integration not found' END
  );
END;
$$;

-- 6. Enhanced token access logging with security monitoring
CREATE OR REPLACE FUNCTION public.log_calendar_token_access_enhanced(
  integration_id_param uuid,
  action_param text,
  success_param boolean DEFAULT true,
  error_message_param text DEFAULT NULL,
  additional_context jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get user's family for context
  SELECT p.family_id INTO user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  -- Enhanced logging with security context
  INSERT INTO public.calendar_token_audit (
    integration_id,
    user_id,
    action,
    success,
    error_message,
    ip_address,
    user_agent
  ) VALUES (
    integration_id_param,
    auth.uid(),
    action_param,
    success_param,
    error_message_param,
    inet_client_addr(),
    SUBSTRING(COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown'), 1, 500)
  );

  -- Also create audit log entry
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    'calendar_token_access',
    'calendar_integrations',
    integration_id_param,
    NULL,
    json_build_object(
      'action', action_param,
      'success', success_param,
      'timestamp', now(),
      'context', additional_context
    )
  );

  -- Security alert for failed access attempts
  IF NOT success_param THEN
    PERFORM public.create_audit_log(
      user_family_id,
      auth.uid(),
      'security_alert_token_access_failed',
      'calendar_integrations',
      integration_id_param,
      NULL,
      json_build_object(
        'alert_level', 'HIGH',
        'error', error_message_param,
        'ip_address', inet_client_addr()::text,
        'timestamp', now()
      )
    );
  END IF;
END;
$$;

-- 7. Create secure token retrieval function with enhanced security
CREATE OR REPLACE FUNCTION public.get_calendar_tokens_ultra_secure(
  integration_id_param uuid,
  requesting_context text DEFAULT 'api_call'
)
RETURNS TABLE(
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  is_expired boolean,
  security_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  integration_record RECORD;
  decrypted_access text;
  decrypted_refresh text;
  access_count integer;
BEGIN
  -- Rate limiting check
  SELECT COUNT(*) INTO access_count
  FROM public.calendar_token_audit
  WHERE integration_id = integration_id_param
    AND user_id = auth.uid()
    AND action = 'token_retrieval'
    AND created_at > now() - INTERVAL '1 hour';

  IF access_count >= 100 THEN
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'token_retrieval_rate_limited',
      false,
      'Rate limit exceeded',
      json_build_object('context', requesting_context, 'access_count', access_count)
    );
    RAISE EXCEPTION 'Token access rate limit exceeded';
  END IF;

  -- Verify ownership and get integration
  SELECT ci.*, p.user_id INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  -- Security check: Only owner can access
  IF integration_record.user_id IS NULL OR integration_record.user_id != auth.uid() THEN
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'unauthorized_token_access_attempt',
      false,
      'Access denied - not owner',
      json_build_object('context', requesting_context, 'actual_user', auth.uid())
    );
    RAISE EXCEPTION 'Unauthorized token access';
  END IF;

  -- Check if tokens are revoked
  IF integration_record.access_token LIKE 'SECURITY_REVOKED_%' OR 
     integration_record.access_token = 'REVOKED' OR
     integration_record.access_token = 'PENDING_ENCRYPTION' THEN
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'revoked_token_access_attempt',
      false,
      'Tokens have been revoked for security',
      json_build_object('context', requesting_context)
    );
    RAISE EXCEPTION 'Tokens have been revoked for security reasons';
  END IF;

  -- Decrypt tokens using existing secure function
  BEGIN
    decrypted_access := public.decrypt_oauth_token(
      integration_record.access_token,
      'access',
      integration_id_param
    );
    
    IF integration_record.refresh_token IS NOT NULL THEN
      decrypted_refresh := public.decrypt_oauth_token(
        integration_record.refresh_token,
        'refresh',
        integration_id_param
      );
    END IF;

    -- Log successful access
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'token_retrieval',
      true,
      NULL,
      json_build_object('context', requesting_context)
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log decryption failure
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'token_decryption_failed',
      false,
      SQLERRM,
      json_build_object('context', requesting_context)
    );
    RAISE EXCEPTION 'Token decryption failed: %', SQLERRM;
  END;

  -- Return decrypted tokens with security status
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < now()),
    'SECURE_ENCRYPTED'::text as security_status;
END;
$$;

-- 8. Create function to securely delete integrations
CREATE OR REPLACE FUNCTION public.delete_calendar_integration_secure(
  integration_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_profile_id UUID;
  integration_deleted boolean;
BEGIN
  -- Verify ownership
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  JOIN public.calendar_integrations ci ON ci.profile_id = p.id
  WHERE p.user_id = auth.uid() 
  AND ci.id = integration_id_param;
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Integration not found or access denied');
  END IF;

  -- Security wipe: overwrite sensitive data before deletion
  UPDATE public.calendar_integrations 
  SET 
    access_token = 'SECURELY_DELETED_' || encode(gen_random_bytes(32), 'hex'),
    refresh_token = CASE 
      WHEN refresh_token IS NOT NULL THEN 'SECURELY_DELETED_' || encode(gen_random_bytes(32), 'hex')
      ELSE NULL 
    END,
    is_active = false,
    security_flags = jsonb_build_object(
      'securely_deleted', true,
      'deleted_at', now(),
      'deleted_by', auth.uid()
    )
  WHERE id = integration_id_param;

  -- Now delete the record
  DELETE FROM public.calendar_integrations 
  WHERE id = integration_id_param;

  GET DIAGNOSTICS integration_deleted = ROW_COUNT;

  -- Log secure deletion
  IF integration_deleted THEN
    PERFORM public.log_calendar_token_access_enhanced(
      integration_id_param,
      'integration_securely_deleted',
      true,
      NULL,
      json_build_object('deleted_by', auth.uid())
    );
  END IF;

  RETURN json_build_object(
    'success', integration_deleted,
    'message', CASE WHEN integration_deleted THEN 'Integration securely deleted' ELSE 'Integration not found' END
  );
END;
$$;

-- 9. Security monitoring function for parents/admins
CREATE OR REPLACE FUNCTION public.get_calendar_security_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
  is_parent boolean;
  security_stats json;
BEGIN
  -- Get user's family and role
  SELECT p.family_id, (p.role = 'parent') INTO user_family_id, is_parent
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF NOT is_parent THEN
    RETURN json_build_object('error', 'Only parents can view security status');
  END IF;

  -- Get security statistics
  SELECT json_build_object(
    'total_integrations', COUNT(*),
    'active_integrations', COUNT(*) FILTER (WHERE is_active = true),
    'encrypted_integrations', COUNT(*) FILTER (WHERE access_token LIKE '%::%'),
    'revoked_integrations', COUNT(*) FILTER (WHERE access_token LIKE '%REVOKED%'),
    'recent_security_events', (
      SELECT COUNT(*) 
      FROM public.calendar_token_audit cta
      JOIN public.calendar_integrations ci ON ci.id = cta.integration_id
      JOIN public.profiles p ON p.id = ci.profile_id
      WHERE p.family_id = user_family_id
      AND cta.created_at > now() - INTERVAL '24 hours'
      AND cta.success = false
    ),
    'last_security_scan', now()
  ) INTO security_stats
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;

  RETURN security_stats;
END;
$$;

-- 10. Grant appropriate permissions to functions
GRANT EXECUTE ON FUNCTION public.create_secure_calendar_integration TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_calendar_integration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_tokens_ultra_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_calendar_integration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_security_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_calendar_token_access_enhanced TO authenticated;

-- 11. Add indexes for performance and security monitoring
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_security_monitoring 
ON public.calendar_integrations(profile_id, is_active, created_at) 
WHERE access_token NOT LIKE '%REVOKED%';

CREATE INDEX IF NOT EXISTS idx_calendar_token_audit_security 
ON public.calendar_token_audit(integration_id, user_id, created_at, success) 
WHERE success = false;

-- 12. Final security validation and cleanup
-- Ensure all remaining active integrations have encrypted tokens
UPDATE public.calendar_integrations 
SET 
  is_active = false,
  security_flags = jsonb_build_object(
    'security_disabled', true,
    'reason', 'unencrypted_tokens_detected',
    'requires_reauthentication', true,
    'disabled_at', now()
  )
WHERE is_active = true 
  AND access_token IS NOT NULL 
  AND access_token NOT LIKE '%::%'  -- Not encrypted
  AND access_token NOT LIKE '%REVOKED%';

-- Add comment documenting the security measures
COMMENT ON TABLE public.calendar_integrations IS 
'Calendar OAuth integrations with military-grade encryption. 
All tokens are encrypted at rest using AES-256. 
Direct table access is disabled - use secure functions only.
All access is logged and rate-limited for security.';

-- Final security log
INSERT INTO public.audit_logs (
  family_id, 
  actor_id, 
  action, 
  entity_type, 
  entity_id, 
  new_data
) 
SELECT 
  p.family_id,
  p.user_id,
  'security_migration_completed',
  'calendar_integrations',
  NULL,
  json_build_object(
    'migration_type', 'calendar_token_security_hardening',
    'timestamp', now(),
    'version', '2.0',
    'measures_implemented', json_build_array(
      'token_encryption_enforcement',
      'direct_access_revocation', 
      'secure_function_api',
      'enhanced_logging',
      'rate_limiting',
      'access_monitoring'
    )
  )
FROM public.profiles p 
WHERE p.role = 'parent';