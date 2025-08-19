-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view family members" ON public.profiles;

-- Create a simple policy for users to view their own profile (no recursion)
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- Create a security definer function to check family relationships safely
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create a policy for family members to view each other using the security definer function
CREATE POLICY "Family members can view each other" 
ON public.profiles 
FOR SELECT 
USING (family_id = public.get_user_family_id());