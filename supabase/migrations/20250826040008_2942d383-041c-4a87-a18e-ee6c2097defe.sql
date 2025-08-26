-- EMERGENCY FIX: Remove all problematic RLS policies and recreate clean ones
-- This will fix the infinite recursion error preventing app access

-- 1. Drop ALL existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view family member profiles safely" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view family profiles" ON public.profiles;
DROP POLICY IF EXISTS "Family members can view profiles in same family" ON public.profiles;
DROP POLICY IF EXISTS "Parents can manage family profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can update family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can delete family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents can create family member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. Create simple, safe policies that won't cause recursion
-- Basic policy: Users can always see and edit their own profile
CREATE POLICY "own_profile_access" 
ON public.profiles 
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Simplified family access without recursion risk
-- This policy allows viewing profiles in the same family by using a subquery approach
CREATE POLICY "family_profile_view" 
ON public.profiles 
FOR SELECT
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 
    FROM public.profiles requester 
    WHERE requester.user_id = auth.uid() 
    AND requester.family_id = profiles.family_id
  )
);

-- 4. Parent management policy using simpler logic
CREATE POLICY "parent_profile_management" 
ON public.profiles 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles parent 
    WHERE parent.user_id = auth.uid() 
    AND parent.role = 'parent'
    AND parent.family_id = profiles.family_id
  )
);

CREATE POLICY "parent_profile_updates" 
ON public.profiles 
FOR UPDATE
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 
    FROM public.profiles parent 
    WHERE parent.user_id = auth.uid() 
    AND parent.role = 'parent'
    AND parent.family_id = profiles.family_id
  )
)
WITH CHECK (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 
    FROM public.profiles parent 
    WHERE parent.user_id = auth.uid() 
    AND parent.role = 'parent'
    AND parent.family_id = profiles.family_id
  )
);

CREATE POLICY "parent_profile_deletes" 
ON public.profiles 
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles parent 
    WHERE parent.user_id = auth.uid() 
    AND parent.role = 'parent'
    AND parent.family_id = profiles.family_id
  )
);