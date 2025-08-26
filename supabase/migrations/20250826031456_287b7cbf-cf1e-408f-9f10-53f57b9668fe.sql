-- Fix security definer view issues and complete token security implementation

-- 1. Drop the security definer views and replace with regular views with proper RLS
DROP VIEW IF EXISTS public.calendar_integrations_safe;
DROP VIEW IF EXISTS public.profiles_safe;

-- 2. Update calendar integration functions to use direct table access with enhanced security
CREATE OR REPLACE FUNCTION public.get_user_calendar_integrations_secure()
 RETURNS TABLE(
   id uuid, 
   integration_type text, 
   calendar_id text, 
   is_active boolean, 
   created_at timestamp with time zone, 
   updated_at timestamp with time zone, 
   expires_at timestamp with time zone, 
   is_token_expired boolean, 
   last_token_refresh timestamp with time zone, 
   token_refresh_count integer, 
   has_access_token boolean, 
   has_refresh_token boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Return calendar integrations metadata only (no sensitive tokens)
  RETURN QUERY
  SELECT 
    ci.id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_token_expired,
    ci.last_token_refresh,
    ci.token_refresh_count,
    (ci.access_token IS NOT NULL AND ci.access_token != 'REVOKED') as has_access_token,
    (ci.refresh_token IS NOT NULL AND ci.refresh_token != 'REVOKED') as has_refresh_token
  FROM public.calendar_integrations ci
  WHERE ci.profile_id = user_profile_id
  ORDER BY ci.created_at DESC;
END;
$function$;

-- 3. Enhanced secure token storage with automatic encryption
CREATE OR REPLACE FUNCTION public.store_calendar_tokens_secure(
  integration_id_param uuid, 
  access_token_param text, 
  refresh_token_param text DEFAULT NULL, 
  expires_at_param timestamp with time zone DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  integration_owner UUID;
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
BEGIN
  -- Verify integration ownership
  SELECT p.user_id INTO integration_owner
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;
  
  IF integration_owner IS NULL OR integration_owner != auth.uid() THEN
    -- Log unauthorized attempt
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'unauthorized_token_storage_attempt',
      false,
      json_build_object('attempted_by', auth.uid())
    );
    
    RETURN json_build_object('success', false, 'error', 'Unauthorized access to integration');
  END IF;

  -- Always encrypt tokens before storage
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'access');
  
  IF refresh_token_param IS NOT NULL THEN
    encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'refresh');
  END IF;

  -- Store encrypted tokens
  UPDATE public.calendar_integrations 
  SET 
    access_token = encrypted_access_token,
    refresh_token = encrypted_refresh_token,
    expires_at = expires_at_param,
    updated_at = NOW(),
    last_token_refresh = NOW(),
    token_refresh_count = COALESCE(token_refresh_count, 0) + 1
  WHERE id = integration_id_param;

  -- Log successful secure token storage
  PERFORM public.log_sensitive_access(
    'calendar_integrations',
    integration_id_param,
    'tokens_encrypted_and_stored',
    true,
    json_build_object('expires_at', expires_at_param)
  );

  RETURN json_build_object('success', true, 'message', 'Tokens encrypted and stored securely');
END;
$function$;

-- 4. Create secure profile access function instead of view
CREATE OR REPLACE FUNCTION public.get_family_profiles_secure()
 RETURNS TABLE(
   id uuid,
   user_id uuid,
   family_id uuid,
   display_name text,
   role user_role,
   total_points integer,
   avatar_url text,
   can_add_for_self boolean,
   can_add_for_siblings boolean,
   can_add_for_parents boolean,
   status text,
   color text,
   streak_count integer,
   sort_order integer,
   theme jsonb,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   failed_pin_attempts integer,
   pin_locked_until timestamp with time zone,
   has_pin_set boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_family_id UUID;
  is_parent BOOLEAN;
BEGIN
  -- Get current user's family and role
  SELECT p.family_id, (p.role = 'parent') 
  INTO current_user_family_id, is_parent
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF current_user_family_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Return profiles with conditional sensitive data access
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.family_id,
    p.display_name,
    p.role,
    p.total_points,
    p.avatar_url,
    p.can_add_for_self,
    p.can_add_for_siblings,
    p.can_add_for_parents,
    p.status,
    p.color,
    p.streak_count,
    p.sort_order,
    p.theme,
    p.created_at,
    p.updated_at,
    -- Only show PIN-related fields to parents or profile owners
    CASE 
      WHEN p.user_id = auth.uid() OR is_parent
      THEN p.failed_pin_attempts 
      ELSE NULL 
    END::integer as failed_pin_attempts,
    CASE 
      WHEN p.user_id = auth.uid() OR is_parent
      THEN p.pin_locked_until 
      ELSE NULL 
    END as pin_locked_until,
    -- Never expose PIN hash directly
    (p.pin_hash IS NOT NULL) as has_pin_set
  FROM public.profiles p
  WHERE p.family_id = current_user_family_id;
END;
$function$;

-- 5. Enhanced token validation with automatic cleanup
CREATE OR REPLACE FUNCTION public.validate_and_cleanup_tokens()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cleaned_count INTEGER := 0;
  expired_count INTEGER := 0;
BEGIN
  -- Mark expired tokens as inactive
  UPDATE public.calendar_integrations 
  SET 
    is_active = false,
    security_flags = COALESCE(security_flags, '{}'::jsonb) || 
                    json_build_object('auto_deactivated_at', NOW(), 'reason', 'token_expired')::jsonb
  WHERE expires_at IS NOT NULL 
  AND expires_at < NOW() 
  AND is_active = true;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Clean up revoked tokens older than 30 days
  DELETE FROM public.calendar_integrations 
  WHERE access_token = 'REVOKED' 
  AND updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'expired_tokens_deactivated', expired_count,
    'old_revoked_tokens_cleaned', cleaned_count
  );
END;
$function$;