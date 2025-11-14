-- Fix PIN hash exposure vulnerability
-- Remove the overly permissive policy that exposes sensitive PIN data
DROP POLICY IF EXISTS "users_can_view_family_profiles_safely" ON public.profiles;

-- Create separate policies with proper field restrictions
-- Policy 1: Users can view their OWN profile with ALL fields
CREATE POLICY "users_can_view_own_profile_full"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Users CANNOT directly view other family members' profiles with sensitive data
-- Instead, they must use the get_family_profiles_safe() function which excludes:
-- - pin_hash
-- - pin_locked_until  
-- - failed_pin_attempts
-- This policy intentionally does NOT grant SELECT for other family members
-- to force use of the safe function

-- Update the safe function to ensure it's the only way to view family profiles
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
SET search_path TO 'public'
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
    -- NEVER expose pin_hash, pin_locked_until, or failed_pin_attempts
    -- Only return a safe boolean indicator
    (p.pin_hash IS NOT NULL) as has_pin
  FROM public.profiles p
  WHERE p.family_id = user_family_id;
END;
$$;

-- Add comment explaining the security model
COMMENT ON POLICY "users_can_view_own_profile_full" ON public.profiles IS 
'Users can view their own profile with all fields including sensitive PIN data';

COMMENT ON FUNCTION public.get_family_profiles_safe() IS 
'Secure function to view family profiles WITHOUT exposing PIN hashes, lock times, or failed attempts. This is the ONLY safe way to view other family members profiles.';