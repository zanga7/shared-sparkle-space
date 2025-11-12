-- Clear all task-related data
-- Start with dependent tables first

-- Delete all task completions
DELETE FROM public.task_completions;

-- Delete all task assignees
DELETE FROM public.task_assignees;

-- Delete all tasks (including rotating task references)
DELETE FROM public.tasks;

-- Clean up any orphaned points_ledger entries related to tasks
-- (Keep entries without task_id as those are for rewards, etc.)
DELETE FROM public.points_ledger WHERE task_id IS NOT NULL;

-- Reset all member points to 0 since we cleared task completions
UPDATE public.profiles SET total_points = 0;