-- Create database function to generate recurring tasks
CREATE OR REPLACE FUNCTION generate_initial_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
    next_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate the first due date based on recurring frequency
    CASE NEW.recurring_frequency
        WHEN 'daily' THEN
            next_due_date := CURRENT_TIMESTAMP + (NEW.recurring_interval || ' days')::INTERVAL;
        WHEN 'weekly' THEN
            next_due_date := CURRENT_TIMESTAMP + (NEW.recurring_interval * 7 || ' days')::INTERVAL;
        WHEN 'monthly' THEN
            next_due_date := CURRENT_TIMESTAMP + (NEW.recurring_interval || ' months')::INTERVAL;
        ELSE
            next_due_date := CURRENT_TIMESTAMP + INTERVAL '1 day';
    END CASE;

    -- Create the first task instance
    INSERT INTO public.tasks (
        family_id,
        title,
        description,
        points,
        assigned_to,
        due_date,
        created_by,
        series_id,
        is_repeating
    ) VALUES (
        NEW.family_id,
        NEW.title,
        NEW.description,
        NEW.points,
        NEW.assigned_to,
        next_due_date,
        NEW.created_by,
        NEW.id,
        false
    );

    -- Update the series with the next due date
    UPDATE public.task_series 
    SET 
        last_generated_date = next_due_date,
        next_due_date = CASE NEW.recurring_frequency
            WHEN 'daily' THEN next_due_date + (NEW.recurring_interval || ' days')::INTERVAL
            WHEN 'weekly' THEN next_due_date + (NEW.recurring_interval * 7 || ' days')::INTERVAL
            WHEN 'monthly' THEN next_due_date + (NEW.recurring_interval || ' months')::INTERVAL
        END
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to generate first task when series is created
CREATE TRIGGER trigger_generate_initial_recurring_task
AFTER INSERT ON public.task_series
FOR EACH ROW
EXECUTE FUNCTION generate_initial_recurring_task();