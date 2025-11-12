-- First, identify and remove duplicate task completions
-- Keep the earliest completion for each (task_id, completed_by) pair
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY task_id, completed_by 
           ORDER BY completed_at ASC
         ) as rn
  FROM public.task_completions
)
DELETE FROM public.task_completions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Recalculate total_points for all profiles to fix any corruption
-- This will be the correct baseline going forward
UPDATE public.profiles p
SET total_points = COALESCE((
  SELECT SUM(points)
  FROM public.points_ledger pl
  WHERE pl.profile_id = p.id
), 0);