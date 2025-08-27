-- Migration to fix legacy recurring tasks
-- Create task_series records for existing recurring tasks that don't have series_id

DO $$
DECLARE
    legacy_task RECORD;
    new_series_id UUID;
BEGIN
    -- Loop through all tasks that are marked as repeating but don't have a series_id
    FOR legacy_task IN 
        SELECT id, family_id, title, description, points, assigned_to, created_by, due_date, created_at
        FROM tasks 
        WHERE is_repeating = true AND series_id IS NULL
    LOOP
        -- Create a new task_series record with default weekly recurrence
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
            start_date,
            next_due_date
        ) VALUES (
            legacy_task.family_id,
            legacy_task.title,
            legacy_task.description,
            legacy_task.points,
            legacy_task.assigned_to,
            'weekly',
            1,
            ARRAY[1], -- Default to Monday
            true,
            legacy_task.created_by,
            COALESCE(legacy_task.due_date, legacy_task.created_at),
            COALESCE(legacy_task.due_date, legacy_task.created_at + INTERVAL '7 days')
        ) RETURNING id INTO new_series_id;
        
        -- Update the task to reference the new series
        UPDATE tasks 
        SET series_id = new_series_id
        WHERE id = legacy_task.id;
        
        RAISE NOTICE 'Migrated legacy recurring task % to series %', legacy_task.title, new_series_id;
    END LOOP;
    
    RAISE NOTICE 'Legacy recurring task migration completed';
END $$;