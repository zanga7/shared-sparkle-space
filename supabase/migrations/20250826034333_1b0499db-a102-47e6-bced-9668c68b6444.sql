-- Fix infinite recursion in profiles table policies
-- The issue is that get_user_family_id() function is querying the same profiles table that the policy is protecting

-- 1. Drop the problematic RLS policy
DROP POLICY IF EXISTS "Parents can view family member basic info" ON public.profiles;

-- 2. Create a new security definer function to get family ID without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_family_id_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3. Create new safe policy for parents to view family members
CREATE POLICY "Parents can view family member profiles safely" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles parent_profile
    WHERE parent_profile.user_id = auth.uid() 
    AND parent_profile.role = 'parent'::user_role 
    AND parent_profile.family_id = profiles.family_id
  )
);

-- 4. Also create a safe family access function to replace get_user_family_id() where used
CREATE OR REPLACE FUNCTION public.is_same_family_safe(target_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND family_id = target_family_id
  );
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_family_id_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_same_family_safe TO authenticated;

-- 6. Update any other functions that might be causing recursion
-- Replace get_user_family_id with direct query in some contexts
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;