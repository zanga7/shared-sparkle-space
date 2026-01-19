-- Allow super admins to view ALL families
CREATE POLICY "Super admins can view all families"
ON public.families
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Also need policies on profiles, tasks, events, lists, rewards for the view aggregations
-- Super admins need to see all profiles to count members
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Super admins need to count tasks across all families
CREATE POLICY "Super admins can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Super admins need to count events across all families  
CREATE POLICY "Super admins can view all events"
ON public.events
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Super admins need to count lists across all families
CREATE POLICY "Super admins can view all lists"
ON public.lists
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Super admins need to count rewards across all families
CREATE POLICY "Super admins can view all rewards"
ON public.rewards
FOR SELECT
TO authenticated
USING (is_super_admin());