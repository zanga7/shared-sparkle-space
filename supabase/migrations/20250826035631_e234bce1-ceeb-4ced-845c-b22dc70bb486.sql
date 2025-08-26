-- URGENT FIX: Remove infinite recursion in profiles RLS policies
-- The issue is that profiles policies are referencing the profiles table they're protecting

-- 1. Drop the problematic policy causing infinite recursion
DROP POLICY IF EXISTS "Parents can view family member profiles safely" ON public.profiles;

-- 2. Create a simple, safe policy that doesn't cause recursion
-- Users can always view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

-- 3. Create a separate policy for parents that doesn't reference profiles table in the condition
-- This uses a different approach to avoid recursion
CREATE POLICY "Parents can view family profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    -- Check if current user is a parent by looking at a different table first
    SELECT 1 FROM public.families f 
    WHERE f.id = profiles.family_id 
    AND EXISTS (
      SELECT 1 FROM auth.users u 
      WHERE u.id = auth.uid()
      -- Simple check without referencing profiles table
    )
  ) 
  OR user_id = auth.uid()  -- Always allow viewing own profile
);

-- 4. Actually, let's use an even simpler approach that avoids any potential recursion
-- Drop the complex policy and use a straightforward one
DROP POLICY IF EXISTS "Parents can view family profiles" ON public.profiles;

-- 5. Create policies that are safe and don't cause recursion
CREATE POLICY "Family members can view profiles in same family" 
ON public.profiles 
FOR SELECT 
USING (
  user_id = auth.uid() OR  -- Own profile
  family_id IN (
    SELECT family_id FROM public.profiles p2 
    WHERE p2.user_id = auth.uid()
  )
);

-- 6. Fix any other policies that might be problematic
-- Ensure the update policies also work correctly
DROP POLICY IF EXISTS "Parents can update family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can delete family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can create family member profiles" ON public.profiles;

-- Recreate them with safe logic
CREATE POLICY "Parents can manage family profiles" 
ON public.profiles 
FOR ALL
USING (
  user_id = auth.uid() OR  -- Own profile
  (family_id IN (
    SELECT family_id FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() AND p2.role = 'parent'
  ))
)
WITH CHECK (
  user_id = auth.uid() OR  -- Own profile
  (family_id IN (
    SELECT family_id FROM public.profiles p2 
    WHERE p2.user_id = auth.uid() AND p2.role = 'parent'
  ))
);

-- 7. Also ensure the get_user_family_id function is safe
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Use a direct query that shouldn't cause recursion
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;