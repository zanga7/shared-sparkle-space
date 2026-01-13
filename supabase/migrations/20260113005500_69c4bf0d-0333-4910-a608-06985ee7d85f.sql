
-- Delete all task-related data in proper order (respecting foreign keys)

-- 1. Delete task completions first (references tasks)
DELETE FROM task_completions;

-- 2. Delete task assignees (references tasks)
DELETE FROM task_assignees;

-- 3. Delete materialized task instances (references tasks and task_series)
DELETE FROM materialized_task_instances;

-- 4. Delete rotation events (references tasks and rotating_tasks)
DELETE FROM rotation_events;

-- 5. Delete recurrence exceptions for tasks
DELETE FROM recurrence_exceptions WHERE series_type = 'task';

-- 6. Delete all tasks (references rotating_tasks)
DELETE FROM tasks;

-- 7. Delete task series
DELETE FROM task_series;

-- 8. Delete rotating tasks
DELETE FROM rotating_tasks;
