-- Alternative approach: Create secure functions instead of problematic views

-- 1. Create function to get secure calendar integration data
CREATE OR REPLACE FUNCTION public.get_calendar_integrations_metadata()
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  integration_type text,
  calendar_id text,
  is_active boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_token_refresh timestamp with time zone,
  token_refresh_count integer,
  has_access_token boolean,
  has_refresh_token boolean,
  is_encrypted boolean,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile_id UUID;
BEGIN
  -- Get current user's profile
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.expires_at,
    ci.created_at,
    ci.updated_at,
    ci.last_token_refresh,
    ci.token_refresh_count,
    -- Safe computed fields only - never expose actual tokens
    (ci.access_token IS NOT NULL AND ci.access_token != 'REVOKED') as has_access_token,
    (ci.refresh_token IS NOT NULL AND ci.refresh_token != 'REVOKED') as has_refresh_token,
    (ci.access_token LIKE '%::%') as is_encrypted,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_expired
  FROM public.calendar_integrations ci
  WHERE ci.profile_id = user_profile_id
  ORDER BY ci.created_at DESC;
END;
$$;

-- 2. Create function to get secure Google Photos integration data
CREATE OR REPLACE FUNCTION public.get_google_photos_integrations_metadata()
RETURNS TABLE(
  id uuid,
  family_id uuid,
  created_by uuid,
  album_id text,
  album_name text,
  is_active boolean,
  sync_count integer,
  last_sync_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  has_access_token boolean,
  has_refresh_token boolean,
  is_encrypted boolean,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family
  user_family_id := get_current_user_family_id();
  
  IF user_family_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    gpi.id,
    gpi.family_id,
    gpi.created_by,
    gpi.album_id,
    gpi.album_name,
    gpi.is_active,
    gpi.sync_count,
    gpi.last_sync_at,
    gpi.expires_at,
    gpi.created_at,
    gpi.updated_at,
    -- Safe computed fields only - never expose actual tokens
    (gpi.access_token IS NOT NULL) as has_access_token,
    (gpi.refresh_token IS NOT NULL) as has_refresh_token,
    (gpi.access_token LIKE '%::%') as is_encrypted,
    (gpi.expires_at IS NOT NULL AND gpi.expires_at < NOW()) as is_expired
  FROM public.google_photos_integrations gpi
  WHERE gpi.family_id = user_family_id
  ORDER BY gpi.created_at DESC;
END;
$$;

-- 3. Completely lock down direct access to sensitive tables
-- This prevents any possibility of token exposure through direct table access
REVOKE ALL ON public.calendar_integrations FROM authenticated;
REVOKE ALL ON public.google_photos_integrations FROM authenticated;

-- Grant only the minimum required permissions for specific operations
GRANT INSERT, UPDATE, DELETE ON public.calendar_integrations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.google_photos_integrations TO authenticated;

-- But SELECT access is only through secure functions (never direct table access)

-- 4. Update existing RLS policies to be more restrictive
DROP POLICY IF EXISTS "Users can view integration metadata only" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Family members can view Google Photos metadata only" ON public.google_photos_integrations;

-- Create ultra-restrictive SELECT policies (should rarely be used due to revoked permissions)
CREATE POLICY "No direct SELECT access to calendar tokens" 
ON public.calendar_integrations 
FOR SELECT 
USING (false); -- Explicitly deny all direct SELECT access

CREATE POLICY "No direct SELECT access to Google Photos tokens" 
ON public.google_photos_integrations 
FOR SELECT 
USING (false); -- Explicitly deny all direct SELECT access

-- 5. Create secure profile access function
CREATE OR REPLACE FUNCTION public.get_family_profiles_metadata()
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
  has_pin boolean,
  is_own_profile boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family
  user_family_id := get_current_user_family_id();
  
  IF user_family_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    CASE 
      WHEN p.user_id = auth.uid() THEN p.user_id 
      ELSE NULL 
    END as user_id,
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
    -- Safe indicators only - never expose PIN hashes or security data
    (p.pin_hash IS NOT NULL) as has_pin,
    (p.user_id = auth.uid()) as is_own_profile
  FROM public.profiles p
  WHERE p.family_id = user_family_id
  ORDER BY p.sort_order, p.display_name;
END;
$$;