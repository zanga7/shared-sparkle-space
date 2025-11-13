-- Create enum for available modules
CREATE TYPE public.app_module AS ENUM (
  'tasks',
  'calendar',
  'lists',
  'rewards',
  'rotating_tasks',
  'screensaver'
);

-- Create enum for super admin roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'user');

-- Create user_roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create plan_modules junction table
CREATE TABLE public.plan_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE NOT NULL,
  module_name app_module NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE (plan_id, module_name)
);

-- Add current_plan_id to families table
ALTER TABLE public.families 
ADD COLUMN current_plan_id UUID REFERENCES subscription_plans(id);

-- Create family_module_overrides table (only used for custom plans)
CREATE TABLE public.family_module_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  module_name app_module NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (family_id, module_name)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_module_overrides ENABLE ROW LEVEL SECURITY;

-- Security definer function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = 'super_admin'
  )
$$;

-- Function to get available modules for a family
CREATE OR REPLACE FUNCTION public.get_family_modules(check_family_id UUID)
RETURNS TABLE (module_name TEXT, is_enabled BOOLEAN)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  family_plan_id UUID;
  is_custom_plan BOOLEAN;
BEGIN
  -- Get the family's current plan
  SELECT f.current_plan_id INTO family_plan_id
  FROM families f
  WHERE f.id = check_family_id;
  
  -- If no plan assigned, return empty
  IF family_plan_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if it's a custom plan
  SELECT sp.is_custom INTO is_custom_plan
  FROM subscription_plans sp
  WHERE sp.id = family_plan_id;
  
  -- If custom plan, return overrides; otherwise return plan modules
  IF is_custom_plan THEN
    RETURN QUERY
    SELECT fmo.module_name::TEXT, fmo.is_enabled
    FROM family_module_overrides fmo
    WHERE fmo.family_id = check_family_id;
  ELSE
    RETURN QUERY
    SELECT pm.module_name::TEXT, pm.is_enabled
    FROM plan_modules pm
    WHERE pm.plan_id = family_plan_id;
  END IF;
END;
$$;

-- Function to get system-wide statistics
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin only';
  END IF;

  SELECT json_build_object(
    'total_families', (SELECT COUNT(*) FROM families),
    'total_users', (SELECT COUNT(*) FROM profiles),
    'active_families_30d', (
      SELECT COUNT(DISTINCT family_id) 
      FROM audit_logs 
      WHERE created_at > NOW() - INTERVAL '30 days'
    ),
    'total_tasks', (SELECT COUNT(*) FROM tasks),
    'total_events', (SELECT COUNT(*) FROM events),
    'total_lists', (SELECT COUNT(*) FROM lists),
    'total_rewards', (SELECT COUNT(*) FROM rewards),
    'plans_breakdown', (
      SELECT json_object_agg(sp.name, COALESCE(plan_counts.count, 0))
      FROM subscription_plans sp
      LEFT JOIN (
        SELECT current_plan_id, COUNT(*) as count
        FROM families
        WHERE current_plan_id IS NOT NULL
        GROUP BY current_plan_id
      ) plan_counts ON plan_counts.current_plan_id = sp.id
      WHERE sp.is_active = true
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- RLS Policies for user_roles
CREATE POLICY "super_admins_can_view_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "super_admins_can_grant_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- RLS Policies for subscription_plans
CREATE POLICY "super_admins_can_manage_plans"
ON public.subscription_plans FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- RLS Policies for plan_modules
CREATE POLICY "super_admins_can_manage_plan_modules"
ON public.plan_modules FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- RLS Policies for family_module_overrides
CREATE POLICY "super_admins_can_manage_overrides"
ON public.family_module_overrides FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- RLS Policy for families table plan updates
CREATE POLICY "super_admins_can_update_family_plan"
ON public.families FOR UPDATE
TO authenticated
USING (public.is_super_admin());

-- Aggregated statistics view
CREATE OR REPLACE VIEW public.super_admin_family_stats AS
SELECT
  f.id as family_id,
  f.name as family_name,
  f.created_at,
  f.current_plan_id,
  sp.name as plan_name,
  sp.is_custom as is_custom_plan,
  COUNT(DISTINCT p.id) as member_count,
  COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_members,
  MAX(p.updated_at) as last_activity,
  MAX(p.streak_count) as max_streak,
  (SELECT COUNT(*) FROM tasks t WHERE t.family_id = f.id) as task_count,
  (SELECT COUNT(*) FROM events e WHERE e.family_id = f.id) as event_count,
  (SELECT COUNT(*) FROM lists l WHERE l.family_id = f.id) as list_count,
  (SELECT COUNT(*) FROM rewards r WHERE r.family_id = f.id) as reward_count
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
LEFT JOIN subscription_plans sp ON sp.id = f.current_plan_id
GROUP BY f.id, f.name, f.created_at, f.current_plan_id, sp.name, sp.is_custom;

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, is_custom, sort_order) VALUES
  ('Free', 'Basic family management with tasks and lists', false, 1),
  ('Basic', 'Standard features including calendar and rewards', false, 2),
  ('Premium', 'All features unlocked including rotating tasks and screensaver', false, 3),
  ('Custom', 'Custom configuration per family', true, 999);

-- Get plan IDs and insert modules
DO $$
DECLARE
  free_plan_id UUID;
  basic_plan_id UUID;
  premium_plan_id UUID;
BEGIN
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'Free';
  SELECT id INTO basic_plan_id FROM subscription_plans WHERE name = 'Basic';
  SELECT id INTO premium_plan_id FROM subscription_plans WHERE name = 'Premium';

  -- Free Plan: Only tasks and lists
  INSERT INTO plan_modules (plan_id, module_name, is_enabled) VALUES
    (free_plan_id, 'tasks', true),
    (free_plan_id, 'calendar', false),
    (free_plan_id, 'lists', true),
    (free_plan_id, 'rewards', false),
    (free_plan_id, 'rotating_tasks', false),
    (free_plan_id, 'screensaver', false);

  -- Basic Plan: Tasks, lists, calendar, rewards
  INSERT INTO plan_modules (plan_id, module_name, is_enabled) VALUES
    (basic_plan_id, 'tasks', true),
    (basic_plan_id, 'calendar', true),
    (basic_plan_id, 'lists', true),
    (basic_plan_id, 'rewards', true),
    (basic_plan_id, 'rotating_tasks', false),
    (basic_plan_id, 'screensaver', false);

  -- Premium Plan: All modules
  INSERT INTO plan_modules (plan_id, module_name, is_enabled) VALUES
    (premium_plan_id, 'tasks', true),
    (premium_plan_id, 'calendar', true),
    (premium_plan_id, 'lists', true),
    (premium_plan_id, 'rewards', true),
    (premium_plan_id, 'rotating_tasks', true),
    (premium_plan_id, 'screensaver', true);
END $$;