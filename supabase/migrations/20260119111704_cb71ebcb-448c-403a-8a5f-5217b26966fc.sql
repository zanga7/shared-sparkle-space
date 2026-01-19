-- Add DELETE policies for additional tables that super admins may need

-- Delete policy for task_completions
CREATE POLICY "Super admins can delete task_completions"
ON public.task_completions
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for task_assignees
CREATE POLICY "Super admins can delete task_assignees"
ON public.task_assignees
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for task_series
CREATE POLICY "Super admins can delete task_series"
ON public.task_series
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for event_series
CREATE POLICY "Super admins can delete event_series"
ON public.event_series
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for goal_milestones
CREATE POLICY "Super admins can delete goal_milestones"
ON public.goal_milestones
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for goal_assignees
CREATE POLICY "Super admins can delete goal_assignees"
ON public.goal_assignees
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for goal_linked_tasks
CREATE POLICY "Super admins can delete goal_linked_tasks"
ON public.goal_linked_tasks
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for goal_progress_snapshots
CREATE POLICY "Super admins can delete goal_progress_snapshots"
ON public.goal_progress_snapshots
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for list_items
CREATE POLICY "Super admins can delete list_items"
ON public.list_items
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for list_item_assignees
CREATE POLICY "Super admins can delete list_item_assignees"
ON public.list_item_assignees
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for reward_requests
CREATE POLICY "Super admins can delete reward_requests"
ON public.reward_requests
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for group_contributions
CREATE POLICY "Super admins can delete group_contributions"
ON public.group_contributions
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for celebrations
CREATE POLICY "Super admins can delete celebrations"
ON public.celebrations
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for categories
CREATE POLICY "Super admins can delete categories"
ON public.categories
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for holiday_dates
CREATE POLICY "Super admins can delete holiday_dates"
ON public.holiday_dates
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for points_ledger
CREATE POLICY "Super admins can delete points_ledger"
ON public.points_ledger
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for screensaver_images
CREATE POLICY "Super admins can delete screensaver_images"
ON public.screensaver_images
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for screensaver_settings
CREATE POLICY "Super admins can delete screensaver_settings"
ON public.screensaver_settings
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for public_holiday_settings
CREATE POLICY "Super admins can delete public_holiday_settings"
ON public.public_holiday_settings
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for rotating_tasks
CREATE POLICY "Super admins can delete rotating_tasks"
ON public.rotating_tasks
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for rotation_events
CREATE POLICY "Super admins can delete rotation_events"
ON public.rotation_events
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for calendar_integrations
CREATE POLICY "Super admins can delete calendar_integrations"
ON public.calendar_integrations
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for dashboard_sessions
CREATE POLICY "Super admins can delete dashboard_sessions"
ON public.dashboard_sessions
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for materialized_task_instances
CREATE POLICY "Super admins can delete materialized_task_instances"
ON public.materialized_task_instances
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Delete policy for event_attendees
CREATE POLICY "Super admins can delete event_attendees"
ON public.event_attendees
FOR DELETE
TO authenticated
USING (is_super_admin());