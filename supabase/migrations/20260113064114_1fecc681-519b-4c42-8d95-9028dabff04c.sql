-- Add security barrier to super_admin_family_stats view
-- This ensures only super admins can access family statistics

-- Drop existing view and recreate with security barrier
DROP VIEW IF EXISTS super_admin_family_stats;

CREATE VIEW super_admin_family_stats 
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
    f.id AS family_id,
    f.name AS family_name,
    f.status,
    f.created_at,
    f.current_plan_id,
    sp.name AS plan_name,
    sp.is_custom AS is_custom_plan,
    count(DISTINCT p.id) AS member_count,
    count(DISTINCT
        CASE
            WHEN p.status = 'active'::text THEN p.id
            ELSE NULL::uuid
        END) AS active_members,
    max(GREATEST(COALESCE(( SELECT max(tasks.created_at) AS max
           FROM tasks
          WHERE tasks.family_id = f.id), '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(( SELECT max(events.created_at) AS max
           FROM events
          WHERE events.family_id = f.id), '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(( SELECT max(lists.created_at) AS max
           FROM lists
          WHERE lists.family_id = f.id), '1970-01-01 00:00:00+00'::timestamp with time zone))) AS last_activity,
    COALESCE(max(p.streak_count), 0) AS max_streak,
    COALESCE(( SELECT count(*) AS count
           FROM tasks
          WHERE tasks.family_id = f.id), 0::bigint) AS task_count,
    COALESCE(( SELECT count(*) AS count
           FROM events
          WHERE events.family_id = f.id), 0::bigint) AS event_count,
    COALESCE(( SELECT count(*) AS count
           FROM lists
          WHERE lists.family_id = f.id), 0::bigint) AS list_count,
    COALESCE(( SELECT count(*) AS count
           FROM rewards
          WHERE rewards.family_id = f.id), 0::bigint) AS reward_count
FROM families f
LEFT JOIN profiles p ON p.family_id = f.id
LEFT JOIN subscription_plans sp ON sp.id = f.current_plan_id
WHERE is_super_admin() = true
GROUP BY f.id, f.name, f.status, f.created_at, f.current_plan_id, sp.name, sp.is_custom;