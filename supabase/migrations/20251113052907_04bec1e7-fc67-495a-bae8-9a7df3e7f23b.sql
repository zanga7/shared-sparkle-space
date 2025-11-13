-- Update super_admin_family_stats view to include status
DROP VIEW IF EXISTS super_admin_family_stats;

CREATE VIEW super_admin_family_stats
WITH (security_invoker = on)
AS
SELECT 
  f.id as family_id,
  f.name as family_name,
  f.status,
  f.created_at,
  f.current_plan_id,
  sp.name as plan_name,
  sp.is_custom as is_custom_plan,
  COUNT(DISTINCT p.id) as member_count,
  COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_members,
  MAX(GREATEST(
    COALESCE((SELECT MAX(created_at) FROM tasks WHERE family_id = f.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM events WHERE family_id = f.id), '1970-01-01'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM lists WHERE family_id = f.id), '1970-01-01'::timestamptz)
  )) as last_activity,
  COALESCE(MAX(p.streak_count), 0) as max_streak,
  COALESCE((SELECT COUNT(*) FROM tasks WHERE family_id = f.id), 0) as task_count,
  COALESCE((SELECT COUNT(*) FROM events WHERE family_id = f.id), 0) as event_count,
  COALESCE((SELECT COUNT(*) FROM lists WHERE family_id = f.id), 0) as list_count,
  COALESCE((SELECT COUNT(*) FROM rewards WHERE family_id = f.id), 0) as reward_count
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
LEFT JOIN subscription_plans sp ON sp.id = f.current_plan_id
GROUP BY f.id, f.name, f.status, f.created_at, f.current_plan_id, sp.name, sp.is_custom;