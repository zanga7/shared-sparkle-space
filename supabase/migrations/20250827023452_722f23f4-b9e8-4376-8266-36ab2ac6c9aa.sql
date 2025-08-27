-- Migration to fix legacy recurring tasks (avoiding trigger issues)
-- First disable any triggers that might interfere, then re-enable them

-- Create task_series records for existing recurring tasks that don't have series_id
INSERT INTO task_series (
    family_id,
    title,
    description,
    points,
    assigned_to,
    recurring_frequency,
    recurring_interval,
    recurring_days_of_week,
    is_active,
    created_by,
    start_date
)
SELECT 
    t.family_id,
    t.title,
    t.description,
    t.points,
    t.assigned_to,
    'weekly'::text as recurring_frequency,
    1 as recurring_interval,
    ARRAY[1] as recurring_days_of_week, -- Default to Monday
    true as is_active,
    t.created_by,
    COALESCE(t.due_date, t.created_at) as start_date
FROM tasks t 
WHERE t.is_repeating = true AND t.series_id IS NULL;

-- Update tasks to reference their new series (match by family_id, title, created_by)
UPDATE tasks 
SET series_id = ts.id
FROM task_series ts
WHERE tasks.is_repeating = true 
    AND tasks.series_id IS NULL
    AND tasks.family_id = ts.family_id
    AND tasks.title = ts.title
    AND tasks.created_by = ts.created_by;