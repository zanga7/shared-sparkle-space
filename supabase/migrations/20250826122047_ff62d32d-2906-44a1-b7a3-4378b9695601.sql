-- Drop the existing function first, then create the new one with the correct signature
DROP FUNCTION IF EXISTS public.get_family_profiles_safe();

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