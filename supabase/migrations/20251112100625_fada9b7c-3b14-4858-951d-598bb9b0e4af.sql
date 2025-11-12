
-- Fix Luke's points based on actual task completions
UPDATE profiles
SET total_points = (
  SELECT COALESCE(SUM(tc.points_earned), 0)
  FROM task_completions tc
  WHERE tc.completed_by = profiles.id
),
updated_at = now()
WHERE id = '4d0a866c-ebb1-446a-a675-5e04f5fd1597';

-- Clean up corrupted ledger entries with 0 points for "free points" task
DELETE FROM points_ledger
WHERE reason ILIKE '%free points%'
AND points = 0;
