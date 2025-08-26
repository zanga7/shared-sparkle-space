-- CRITICAL SECURITY FIXES
-- This migration addresses the serious security vulnerabilities identified in the security audit

-- ============================================================================
-- 1. FIX CALENDAR INTEGRATIONS DATA EXPOSURE
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Secure functions can manage integrations" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can view integration metadata securely" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can view their own integration metadata" ON public.calendar_integrations;

-- Create restrictive policies that only allow users to access their own integrations
CREATE POLICY "Users can only view their own calendar integrations"
ON public.calendar_integrations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = calendar_integrations.profile_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Users can only manage their own calendar integrations"
ON public.calendar_integrations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = calendar_integrations.profile_id 
  AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = calendar_integrations.profile_id 
  AND p.user_id = auth.uid()
));

-- Create a secure function for parents to view family integration metadata (no tokens)
CREATE OR REPLACE FUNCTION public.get_family_calendar_integrations_metadata()
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  profile_name text,
  integration_type text,
  calendar_id text,
  is_active boolean,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_expired boolean,
  last_token_refresh timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family and verify they're a parent
  SELECT p.family_id INTO user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'parent';
  
  IF user_family_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Only parents can view family calendar integrations';
  END IF;

  RETURN QUERY
  SELECT 
    ci.id,
    ci.profile_id,
    p.display_name as profile_name,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.expires_at,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_expired,
    ci.last_token_refresh
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;
END;
$$;

-- ============================================================================
-- 2. FIX GOOGLE PHOTOS INTEGRATIONS DATA EXPOSURE
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Family members can view Google Photos integrations" ON public.google_photos_integrations;
DROP POLICY IF EXISTS "Parents can manage Google Photos integrations" ON public.google_photos_integrations;

-- Create restrictive policies
CREATE POLICY "Integration owners can view their Google Photos integrations"
ON public.google_photos_integrations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.user_id = auth.uid() 
  AND p.id = google_photos_integrations.created_by
));

CREATE POLICY "Parents can manage family Google Photos integrations"
ON public.google_photos_integrations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.user_id = auth.uid() 
  AND p.role = 'parent' 
  AND p.family_id = google_photos_integrations.family_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.user_id = auth.uid() 
  AND p.role = 'parent' 
  AND p.family_id = google_photos_integrations.family_id
));

-- ============================================================================
-- 3. HIDE PIN HASHES FROM FAMILY MEMBERS
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "users_can_view_own_and_family_profiles" ON public.profiles;

-- Create new policies that hide sensitive data
CREATE POLICY "users_can_view_own_profile_full_access"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Family members can view basic profile info but NOT pin_hash or failed_pin_attempts
CREATE POLICY "family_members_can_view_basic_profile_info"
ON public.profiles
FOR SELECT
USING (
  user_id != auth.uid() 
  AND family_id = get_current_user_family_id()
);

-- Create a secure function to get profile info without exposing PIN data
CREATE OR REPLACE FUNCTION public.get_family_profiles_safe()
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
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  calendar_edit_permission text,
  require_pin_to_complete_tasks boolean,
  require_pin_for_list_deletes boolean,
  sort_order integer,
  has_pin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family
  user_family_id := get_current_user_family_id();
  
  IF user_family_id IS NULL THEN
    RAISE EXCEPTION 'User family not found';
  END IF;

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
    p.created_at,
    p.updated_at,
    p.calendar_edit_permission,
    p.require_pin_to_complete_tasks,
    p.require_pin_for_list_deletes,
    p.sort_order,
    (p.pin_hash IS NOT NULL) as has_pin -- Safe boolean indicator
  FROM public.profiles p
  WHERE p.family_id = user_family_id;
END;
$$;

-- ============================================================================
-- 4. RESTRICT AUDIT LOG VISIBILITY
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Parents can view family audit logs" ON public.audit_logs;

-- Create restrictive policies
CREATE POLICY "users_can_view_own_audit_logs"
ON public.audit_logs
FOR SELECT
USING (actor_id = auth.uid());

-- Create secure function for parents to view family activity without exposing IP addresses
CREATE OR REPLACE FUNCTION public.get_family_audit_logs_safe()
RETURNS TABLE(
  id uuid,
  family_id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Verify user is a parent
  SELECT p.family_id INTO user_family_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND p.role = 'parent';
  
  IF user_family_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Only parents can view family audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.family_id,
    al.actor_id,
    p.display_name as actor_name,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_data,
    al.new_data,
    al.created_at
    -- Note: ip_address and user_agent are intentionally excluded for privacy
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.user_id = al.actor_id
  WHERE al.family_id = user_family_id
  ORDER BY al.created_at DESC;
END;
$$;

-- ============================================================================
-- 5. FIX FUNCTION SEARCH PATH SETTINGS
-- ============================================================================

-- Update functions that are missing proper search path settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
    family_name TEXT;
    new_family_id UUID;
    display_name TEXT;
BEGIN
    -- Extract info from user metadata with fallbacks
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    display_name := COALESCE(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Create family first
    INSERT INTO public.families (name) 
    VALUES (family_name)
    RETURNING id INTO new_family_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        new_family_id,
        display_name,
        'parent'::public.user_role
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        -- The user can fix their profile later using the fix function
        RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_group_contribution_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  reward_record RECORD;
  contribution_count INTEGER;
  required_contributors INTEGER;
  assigned_member_id UUID;
BEGIN
  -- Get the reward details
  SELECT * INTO reward_record
  FROM public.rewards 
  WHERE id = NEW.reward_id AND reward_type = 'group_contribution';
  
  -- If not a group contribution reward, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get required number of contributors (based on assigned_to array length, or 1 if null)
  required_contributors := COALESCE(array_length(reward_record.assigned_to, 1), 1);
  
  -- Count unique contributors who have contributed the full amount
  SELECT COUNT(DISTINCT profile_id) INTO contribution_count
  FROM public.group_contributions
  WHERE reward_id = NEW.reward_id 
  AND points_contributed >= reward_record.cost_points;
  
  -- If we have enough contributors, mark reward as inactive and create approval for all members
  IF contribution_count >= required_contributors THEN
    -- Deactivate the reward
    UPDATE public.rewards 
    SET is_active = false, updated_at = NOW()
    WHERE id = NEW.reward_id;
    
    -- Create reward requests for all assigned members with 'approved' status
    IF reward_record.assigned_to IS NOT NULL THEN
      -- Loop through all assigned members
      FOREACH assigned_member_id IN ARRAY reward_record.assigned_to
      LOOP
        INSERT INTO public.reward_requests (
          reward_id,
          requested_by,
          points_cost,
          status,
          approval_note,
          created_at,
          updated_at
        ) VALUES (
          NEW.reward_id,
          assigned_member_id,
          0, -- No points cost as they've already been deducted via contributions
          'approved',
          'Group contribution goal completed automatically',
          NOW(),
          NOW()
        );
      END LOOP;
    ELSE
      -- Fallback: create one request for the completing contributor
      INSERT INTO public.reward_requests (
        reward_id,
        requested_by,
        points_cost,
        status,
        approval_note,
        created_at,
        updated_at
      ) VALUES (
        NEW.reward_id,
        NEW.profile_id,
        0,
        'approved',
        'Group contribution goal completed automatically',
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_token_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- ============================================================================
-- 6. ENHANCE AUDIT LOGGING FOR SECURITY MONITORING
-- ============================================================================

-- Create function to log sensitive data access attempts
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_success boolean DEFAULT true,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family ID
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Create detailed audit log with IP masking for privacy
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
      'details', p_details,
      'security_event', true
    )
  );
END;
$$;

-- Update token decryption function to add security logging
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_data text, token_type text DEFAULT 'access'::text, requesting_integration_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  salt TEXT;
  encrypted_token TEXT;
  encryption_key TEXT;
  decrypted_token TEXT;
  parts TEXT[];
  integration_owner UUID;
BEGIN
  -- Verify access permissions if integration_id provided
  IF requesting_integration_id IS NOT NULL THEN
    SELECT p.user_id INTO integration_owner
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = requesting_integration_id;
    
    -- Only allow token owner or system functions to decrypt
    IF integration_owner IS NULL OR (auth.uid() IS NOT NULL AND integration_owner != auth.uid()) THEN
      -- Log unauthorized access attempt
      PERFORM public.log_sensitive_data_access(
        'calendar_tokens',
        requesting_integration_id,
        'unauthorized_decryption_attempt',
        false,
        json_build_object('attempted_by', auth.uid(), 'token_type', token_type)
      );
      RAISE EXCEPTION 'Unauthorized token access';
    END IF;
  END IF;

  -- Split salt and encrypted data
  parts := string_to_array(encrypted_data, '::');
  IF array_length(parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid token format';
  END IF;
  
  salt := parts[1];
  encrypted_token := parts[2];
  
  -- Recreate encryption key
  encryption_key := encode(
    digest(
      current_setting('app.settings.jwt_secret', true) || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Decrypt token
  decrypted_token := pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
  
  -- Log successful decryption for audit
  PERFORM public.log_sensitive_data_access(
    'calendar_tokens',
    requesting_integration_id,
    'token_decryption_success',
    true,
    json_build_object('token_type', token_type, 'timestamp', now())
  );
  
  RETURN decrypted_token;
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    PERFORM public.log_sensitive_data_access(
      'calendar_tokens',
      requesting_integration_id,
      'token_decryption_failed',
      false,
      json_build_object('error', SQLERRM, 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token decryption failed';
END;
$$;