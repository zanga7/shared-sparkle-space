-- Remove all tasks from the database
DELETE FROM public.tasks;

-- Also remove related data to maintain consistency
DELETE FROM public.task_assignees;
DELETE FROM public.task_completions;

-- Remove any points ledger entries related to tasks
DELETE FROM public.points_ledger WHERE task_id IS NOT NULL;