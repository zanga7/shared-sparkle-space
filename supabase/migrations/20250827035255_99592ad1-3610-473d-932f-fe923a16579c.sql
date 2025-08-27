-- Final security hardening to completely prevent token exposure

-- 1. Create secure views that completely hide token fields
CREATE OR REPLACE VIEW public.calendar_integrations_secure AS
SELECT 
  id,
  profile_id,
  integration_type,
  calendar_id,
  is_active,
  expires_at,
  created_at,
  updated_at,
  last_token_refresh,
  token_refresh_count,
  created_ip,
  last_access_ip,
  security_flags,
  -- Safe computed fields only
  (access_token IS NOT NULL AND access_token != 'REVOKED') as has_access_token,
  (refresh_token IS NOT NULL AND refresh_token != 'REVOKED') as has_refresh_token,
  (access_token LIKE '%::%') as is_encrypted,
  (expires_at IS NOT NULL AND expires_at < NOW()) as is_expired
FROM public.calendar_integrations;

-- Grant access to authenticated users with RLS
ALTER VIEW public.calendar_integrations_secure OWNER TO postgres;
GRANT SELECT ON public.calendar_integrations_secure TO authenticated;

-- Apply RLS to the secure view
CREATE POLICY "Users can view their own calendar integration metadata" 
ON public.calendar_integrations_secure
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations_secure.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- 2. Create secure view for Google Photos integrations
CREATE OR REPLACE VIEW public.google_photos_integrations_secure AS
SELECT 
  id,
  family_id,
  created_by,
  album_id,
  album_name,
  is_active,
  sync_count,
  last_sync_at,
  expires_at,
  created_at,
  updated_at,
  -- Safe computed fields only
  (access_token IS NOT NULL) as has_access_token,
  (refresh_token IS NOT NULL) as has_refresh_token,
  (access_token LIKE '%::%') as is_encrypted,
  (expires_at IS NOT NULL AND expires_at < NOW()) as is_expired
FROM public.google_photos_integrations;

-- Grant access with RLS
ALTER VIEW public.google_photos_integrations_secure OWNER TO postgres;
GRANT SELECT ON public.google_photos_integrations_secure TO authenticated;

CREATE POLICY "Family members can view Google Photos metadata" 
ON public.google_photos_integrations_secure
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations_secure.family_id 
    AND p.user_id = auth.uid()
  )
);

-- 3. Create secure view for profiles that hides security fields
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  id,
  CASE 
    WHEN user_id = auth.uid() THEN user_id 
    ELSE NULL 
  END as user_id,
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
  created_at,
  updated_at,
  calendar_edit_permission,
  require_pin_to_complete_tasks,
  require_pin_for_list_deletes,
  sort_order,
  theme,
  -- Safe indicators only
  (pin_hash IS NOT NULL) as has_pin,
  -- Security fields only visible to profile owner
  CASE 
    WHEN user_id = auth.uid() THEN failed_pin_attempts 
    ELSE NULL 
  END as failed_pin_attempts,
  CASE 
    WHEN user_id = auth.uid() THEN pin_locked_until 
    ELSE NULL 
  END as pin_locked_until
FROM public.profiles;

-- Grant access with RLS
ALTER VIEW public.profiles_secure OWNER TO postgres;
GRANT SELECT ON public.profiles_secure TO authenticated;

CREATE POLICY "Users can view family profiles securely" 
ON public.profiles_secure
FOR SELECT 
USING (
  family_id = get_current_user_family_id()
);

-- 4. Restrict direct access to the main tables - force use of secure views
-- Revoke direct access to sensitive columns
REVOKE SELECT ON public.calendar_integrations FROM authenticated;
REVOKE SELECT ON public.google_photos_integrations FROM authenticated;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Grant access only to secure views
GRANT SELECT ON public.calendar_integrations_secure TO authenticated;
GRANT SELECT ON public.google_photos_integrations_secure TO authenticated;
GRANT SELECT ON public.profiles_secure TO authenticated;

-- 5. Create function to check if all tokens are properly encrypted
CREATE OR REPLACE FUNCTION public.security_audit_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calendar_total INTEGER;
  calendar_encrypted INTEGER;
  photos_total INTEGER;
  photos_encrypted INTEGER;
  user_family_id UUID;
BEGIN
  -- Get current user's family
  user_family_id := get_current_user_family_id();
  
  IF user_family_id IS NULL THEN
    RETURN json_build_object('error', 'User family not found');
  END IF;

  -- Count calendar integrations
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE access_token LIKE '%::%')
  INTO calendar_total, calendar_encrypted
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;

  -- Count Google Photos integrations
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE access_token LIKE '%::%')
  INTO photos_total, photos_encrypted
  FROM public.google_photos_integrations gpi
  WHERE gpi.family_id = user_family_id;

  RETURN json_build_object(
    'calendar_integrations', json_build_object(
      'total', calendar_total,
      'encrypted', calendar_encrypted,
      'secure', (calendar_total = calendar_encrypted)
    ),
    'photos_integrations', json_build_object(
      'total', photos_total,
      'encrypted', photos_encrypted,
      'secure', (photos_total = photos_encrypted)
    ),
    'overall_secure', (calendar_total = calendar_encrypted AND photos_total = photos_encrypted),
    'scan_timestamp', NOW()
  );
END;
$$;