-- Fix calendar token security with secure functions instead of problematic views

-- 1. Drop the problematic views
DROP VIEW IF EXISTS public.calendar_integrations_safe;
DROP VIEW IF EXISTS public.profiles_safe;

-- 2. Create secure functions to access calendar integration metadata (without tokens)
CREATE OR REPLACE FUNCTION public.get_user_calendar_integrations_safe()
 RETURNS TABLE(
   id uuid,
   profile_id uuid,
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

  -- Return calendar integrations for this user only (no sensitive token data)
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

-- 3. Create secure function to access profile data (hiding PIN hashes appropriately)
CREATE OR REPLACE FUNCTION public.get_family_profiles_safe()
 RETURNS TABLE(
   id uuid,
   user_id uuid,
   family_id uuid,
   display_name text,
   role text,
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
  user_family_id UUID;
  is_parent BOOLEAN;
  requesting_user_id UUID;
BEGIN
  -- Get current user info
  requesting_user_id := auth.uid();
  
  SELECT p.family_id, (p.role = 'parent') INTO user_family_id, is_parent
  FROM public.profiles p
  WHERE p.user_id = requesting_user_id;
  
  IF user_family_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Return family profiles with conditional access to sensitive fields
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.family_id,
    p.display_name,
    p.role::text,
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
    -- Only show PIN-related fields to parents or the profile owner
    CASE 
      WHEN p.user_id = requesting_user_id OR is_parent 
      THEN p.failed_pin_attempts 
      ELSE NULL 
    END as failed_pin_attempts,
    CASE 
      WHEN p.user_id = requesting_user_id OR is_parent 
      THEN p.pin_locked_until 
      ELSE NULL 
    END as pin_locked_until,
    -- Never expose PIN hash directly, only indicate if set
    (p.pin_hash IS NOT NULL) as has_pin_set
  FROM public.profiles p
  WHERE p.family_id = user_family_id
  ORDER BY p.sort_order, p.created_at;
END;
$function$;

-- 4. Enhanced calendar token access function with comprehensive security
CREATE OR REPLACE FUNCTION public.get_calendar_tokens_secure(integration_id_param uuid)
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone, is_expired boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  integration_record RECORD;
  requesting_user_id UUID;
  decrypted_access_token TEXT;
  decrypted_refresh_token TEXT;
BEGIN
  -- Get the requesting user ID
  requesting_user_id := auth.uid();
  
  IF requesting_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to access calendar tokens';
  END IF;
  
  -- Verify this is the token owner with additional security checks
  SELECT ci.*, p.user_id as owner_id, p.family_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param
  AND ci.is_active = true; -- Only allow access to active integrations

  -- Check if integration exists and user owns it
  IF NOT FOUND THEN
    -- Log access attempt to non-existent or inactive integration
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'token_access_not_found',
      false,
      json_build_object('integration_id', integration_id_param)
    );
    
    RAISE EXCEPTION 'Calendar integration not found or inactive';
  END IF;

  IF integration_record.owner_id != requesting_user_id THEN
    -- Log unauthorized access attempt with more details
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'unauthorized_token_access',
      false,
      json_build_object(
        'attempted_by', requesting_user_id,
        'actual_owner', integration_record.owner_id,
        'integration_type', integration_record.integration_type
      )
    );
    
    RAISE EXCEPTION 'Access denied: You can only access your own calendar tokens';
  END IF;

  -- Check if tokens have been revoked
  IF integration_record.access_token = 'REVOKED' THEN
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'revoked_token_access_attempt',
      false,
      json_build_object('integration_type', integration_record.integration_type)
    );
    
    RAISE EXCEPTION 'Calendar integration has been revoked';
  END IF;

  -- Log successful token access
  PERFORM public.log_sensitive_access(
    'calendar_integrations',
    integration_id_param,
    'token_access_success',
    true,
    json_build_object('integration_type', integration_record.integration_type)
  );

  -- Decrypt tokens safely
  BEGIN
    decrypted_access_token := public.decrypt_oauth_token(
      integration_record.access_token, 
      'access', 
      integration_id_param
    );
    
    IF integration_record.refresh_token IS NOT NULL AND integration_record.refresh_token != 'REVOKED' THEN
      decrypted_refresh_token := public.decrypt_oauth_token(
        integration_record.refresh_token, 
        'refresh', 
        integration_id_param
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log decryption failure
      PERFORM public.log_sensitive_access(
        'calendar_integrations',
        integration_id_param,
        'token_decryption_failed',
        false,
        json_build_object('error', SQLERRM)
      );
      
      RAISE EXCEPTION 'Failed to decrypt calendar tokens';
  END;

  -- Return decrypted tokens
  RETURN QUERY SELECT 
    decrypted_access_token,
    decrypted_refresh_token,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;