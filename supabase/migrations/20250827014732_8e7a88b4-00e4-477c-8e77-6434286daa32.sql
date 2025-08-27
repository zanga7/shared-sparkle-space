-- Fix the ambiguous column reference in the task_series trigger
-- Drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS create_first_task_on_series_insert ON task_series;
DROP FUNCTION IF EXISTS create_first_task_from_series();

-- Create a new function that properly handles the column references
CREATE OR REPLACE FUNCTION create_first_task_from_series()
RETURNS TRIGGER AS $$
DECLARE
    calculated_next_due_date DATE;
BEGIN
    -- Calculate next due date based on start_date and frequency
    CASE NEW.recurring_frequency
        WHEN 'daily' THEN
            calculated_next_due_date := COALESCE(NEW.start_date::date, CURRENT_DATE) + (NEW.recurring_interval || ' days')::interval;
        WHEN 'weekly' THEN
            calculated_next_due_date := COALESCE(NEW.start_date::date, CURRENT_DATE) + (NEW.recurring_interval || ' weeks')::interval;
        WHEN 'monthly' THEN
            calculated_next_due_date := COALESCE(NEW.start_date::date, CURRENT_DATE) + (NEW.recurring_interval || ' months')::interval;
        WHEN 'yearly' THEN
            calculated_next_due_date := COALESCE(NEW.start_date::date, CURRENT_DATE) + (NEW.recurring_interval || ' years')::interval;
        ELSE
            calculated_next_due_date := COALESCE(NEW.start_date::date, CURRENT_DATE + 1);
    END CASE;

    -- Update the task_series with calculated dates
    UPDATE task_series 
    SET 
        last_generated_date = COALESCE(NEW.start_date::date, CURRENT_DATE),
        next_due_date = calculated_next_due_date
    WHERE id = NEW.id;

    -- Create the first task instance
    INSERT INTO tasks (
        family_id,
        title,
        description,
        points,
        assigned_to,
        created_by,
        due_date,
        is_repeating,
        series_id,
        completion_rule
    ) VALUES (
        NEW.family_id,
        NEW.title,
        NEW.description,
        NEW.points,
        NEW.assigned_to,
        NEW.created_by,
        COALESCE(NEW.start_date::timestamp, NOW()),
        true,
        NEW.id,
        'everyone'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER create_first_task_on_series_insert
    AFTER INSERT ON task_series
    FOR EACH ROW
    EXECUTE FUNCTION create_first_task_from_series();