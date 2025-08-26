-- Fix calendar token security vulnerabilities

-- 1. Update calendar integrations RLS policy to restrict access to token owner only
DROP POLICY IF EXISTS "Users can manage their own calendar integrations" ON public.calendar_integrations;

-- Create more restrictive policies that separate token access from general metadata access
CREATE POLICY "Users can view their own calendar integration metadata"
ON public.calendar_integrations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own calendar integrations"
ON public.calendar_integrations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own calendar integrations"
ON public.calendar_integrations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own calendar integrations"
ON public.calendar_integrations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- 2. Create secure view for calendar integration access that hides sensitive token data
CREATE OR REPLACE VIEW public.calendar_integrations_safe AS
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

-- Grant access to the safe view
GRANT SELECT ON public.calendar_integrations_safe TO authenticated;

-- 3. Create a separate secure function for token access that ensures proper authorization
CREATE OR REPLACE FUNCTION public.get_calendar_tokens_secure(integration_id_param uuid)
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone, is_expired boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  integration_record RECORD;
  requesting_user_id UUID;
BEGIN
  -- Get the requesting user ID
  requesting_user_id := auth.uid();
  
  -- Verify this is the token owner
  SELECT ci.*, p.user_id as owner_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  -- Check if integration exists and user owns it
  IF NOT FOUND OR integration_record.owner_id != requesting_user_id THEN
    -- Log unauthorized access attempt
    PERFORM public.create_audit_log(
      NULL,
      requesting_user_id,
      'unauthorized_token_access_attempt',
      'calendar_integrations',
      integration_id_param,
      NULL,
      json_build_object(
        'attempted_by', requesting_user_id,
        'owner_id', integration_record.owner_id,
        'timestamp', NOW()
      )
    );
    
    RAISE EXCEPTION 'Access denied: You can only access your own calendar tokens';
  END IF;

  -- Decrypt and return tokens only to authorized owner
  RETURN QUERY SELECT 
    public.decrypt_oauth_token(integration_record.access_token, 'access', integration_id_param),
    CASE 
      WHEN integration_record.refresh_token IS NOT NULL THEN 
        public.decrypt_oauth_token(integration_record.refresh_token, 'refresh', integration_id_param)
      ELSE NULL
    END,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;

-- 4. Enhance PIN hash security by restricting access to parents and profile owners only
DROP POLICY IF EXISTS "Family members can view each other" ON public.profiles;

-- Create separate policies for different types of profile access
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Parents can view family member basic info"
ON public.profiles
FOR SELECT
USING (
  family_id = get_user_family_id() AND
  EXISTS (
    SELECT 1 FROM public.profiles parent_profile
    WHERE parent_profile.user_id = auth.uid() 
    AND parent_profile.role = 'parent'
    AND parent_profile.family_id = profiles.family_id
  )
);

-- 5. Create a secure view for profile data that hides PIN hashes from non-authorized users
CREATE OR REPLACE VIEW public.profiles_safe AS
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
  -- Only show PIN-related fields to parents or profile owners
  CASE 
    WHEN user_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM public.profiles parent_p 
           WHERE parent_p.user_id = auth.uid() 
           AND parent_p.role = 'parent' 
           AND parent_p.family_id = profiles.family_id
         ) 
    THEN failed_pin_attempts 
    ELSE NULL 
  END as failed_pin_attempts,
  CASE 
    WHEN user_id = auth.uid() OR 
         EXISTS (
           SELECT 1 FROM public.profiles parent_p 
           WHERE parent_p.user_id = auth.uid() 
           AND parent_p.role = 'parent' 
           AND parent_p.family_id = profiles.family_id
         ) 
    THEN pin_locked_until 
    ELSE NULL 
  END as pin_locked_until,
  -- Never expose PIN hash directly through views
  (pin_hash IS NOT NULL) as has_pin_set
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- 6. Enhanced audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_success boolean DEFAULT true,
  p_details jsonb DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family ID
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Create detailed audit log
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    NULL,
    json_build_object(
      'success', p_success,
      'timestamp', NOW(),
      'ip_address', inet_client_addr()::text,
      'details', p_details
    )
  );
END;
$function$;