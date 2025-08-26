-- Fix security definer view issues by using regular views with RLS

-- 1. Drop the problematic security definer views and recreate as regular views
DROP VIEW IF EXISTS public.calendar_integrations_safe;
DROP VIEW IF EXISTS public.profiles_safe;

-- 2. Create regular views with RLS protection
CREATE VIEW public.calendar_integrations_safe AS
SELECT 
  id,
  profile_id,
  integration_type,
  calendar_id,
  is_active,
  created_at,
  updated_at,
  expires_at,
  (expires_at IS NOT NULL AND expires_at < NOW()) as is_token_expired,
  last_token_refresh,
  token_refresh_count,
  (access_token IS NOT NULL AND access_token != 'REVOKED') as has_access_token,
  (refresh_token IS NOT NULL AND refresh_token != 'REVOKED') as has_refresh_token
FROM public.calendar_integrations;

-- Enable RLS on the safe view
ALTER VIEW public.calendar_integrations_safe SET (security_invoker = true);

-- 3. Create regular view for profile data that conditionally shows sensitive fields
CREATE VIEW public.profiles_safe AS
SELECT 
  id,
  user_id,
  family_id,
  display_name,
  role,
  total_points,
  avatar_url,
  can_add_for_self,
  can_add_for_siblings,
  can_add_for_parents,
  status,
  color,
  streak_count,
  sort_order,
  theme,
  created_at,
  updated_at,
  -- Conditionally show PIN-related fields based on access rights
  CASE 
    WHEN user_id = auth.uid() THEN failed_pin_attempts 
    ELSE NULL 
  END as failed_pin_attempts,
  CASE 
    WHEN user_id = auth.uid() THEN pin_locked_until 
    ELSE NULL 
  END as pin_locked_until,
  -- Never expose PIN hash directly, only indicate if set
  (pin_hash IS NOT NULL) as has_pin_set
FROM public.profiles;

-- Enable security invoker for the profiles safe view
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- 4. Create RLS policies for the safe views
CREATE POLICY "calendar_integrations_safe_policy" ON public.calendar_integrations_safe
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations_safe.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Note: profiles_safe will inherit the RLS policies from the underlying profiles table

-- 5. Update the secure token access function to add more security logging
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
  
  -- Verify this is the token owner
  SELECT ci.*, p.user_id as owner_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  -- Check if integration exists and user owns it
  IF NOT FOUND THEN
    -- Log access attempt to non-existent integration
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'token_access_not_found',
      false,
      json_build_object('integration_id', integration_id_param)
    );
    
    RAISE EXCEPTION 'Calendar integration not found';
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
    
    IF integration_record.refresh_token IS NOT NULL THEN
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