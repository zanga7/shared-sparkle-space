-- Allow super admins to delete families
CREATE POLICY "Super admins can delete families"
ON public.families
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete profiles (for cascading family deletion)
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete tasks
CREATE POLICY "Super admins can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete events
CREATE POLICY "Super admins can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete lists
CREATE POLICY "Super admins can delete lists"
ON public.lists
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete rewards
CREATE POLICY "Super admins can delete rewards"
ON public.rewards
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete goals
CREATE POLICY "Super admins can delete goals"
ON public.goals
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete household_settings
CREATE POLICY "Super admins can delete household_settings"
ON public.household_settings
FOR DELETE
TO authenticated
USING (is_super_admin());