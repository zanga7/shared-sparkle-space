-- Drop the problematic policy first
DROP POLICY IF EXISTS "Parents can create family member profiles" ON public.profiles;

-- Create a security definer function to check if current user is a parent
CREATE OR REPLACE FUNCTION public.is_current_user_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'parent'
  );
$$;

-- Create new INSERT policy using the security definer function
CREATE POLICY "Parents can create family member profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_current_user_parent());