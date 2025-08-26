-- Fix infinite recursion in profiles RLS policies by creating security definer functions

-- Create a security definer function to safely get current user's family_id
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID AS $$
DECLARE
  result UUID;
BEGIN
  SELECT family_id INTO result 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a security definer function to safely check if user is parent
CREATE OR REPLACE FUNCTION public.is_current_user_parent()
RETURNS boolean AS $$
DECLARE
  result boolean;
BEGIN
  SELECT (role = 'parent') INTO result
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "family_profile_view" ON public.profiles;
DROP POLICY IF EXISTS "own_profile_access" ON public.profiles;
DROP POLICY IF EXISTS "parent_profile_deletes" ON public.profiles;
DROP POLICY IF EXISTS "parent_profile_management" ON public.profiles;
DROP POLICY IF EXISTS "parent_profile_updates" ON public.profiles;

-- Create new non-recursive policies

-- Users can view their own profile and family members
CREATE POLICY "users_can_view_own_and_family_profiles" 
ON public.profiles FOR SELECT 
USING (
  user_id = auth.uid() OR 
  family_id = public.get_current_user_family_id()
);

-- Users can update their own profile
CREATE POLICY "users_can_update_own_profile" 
ON public.profiles FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "users_can_insert_own_profile" 
ON public.profiles FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Parents can manage family profiles
CREATE POLICY "parents_can_manage_family_profiles" 
ON public.profiles FOR ALL 
USING (
  public.is_current_user_parent() AND 
  family_id = public.get_current_user_family_id()
)
WITH CHECK (
  public.is_current_user_parent() AND 
  family_id = public.get_current_user_family_id()
);

-- Parents can delete family profiles (except their own)
CREATE POLICY "parents_can_delete_family_profiles" 
ON public.profiles FOR DELETE 
USING (
  public.is_current_user_parent() AND 
  family_id = public.get_current_user_family_id() AND
  user_id != auth.uid()
);