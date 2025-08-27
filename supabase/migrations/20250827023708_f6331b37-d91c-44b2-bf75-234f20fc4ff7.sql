-- Fix the ambiguous column reference in the trigger function
-- The issue is in the generate_initial_recurring_task function

CREATE OR REPLACE FUNCTION public.generate_initial_recurring_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Create the initial task instance if this is a new series
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.tasks (
            family_id,
            title,
            description,
            points,
            assigned_to,
            created_by,
            due_date,
            is_repeating,
            series_id
        ) VALUES (
            NEW.family_id,
            NEW.title,
            NEW.description,
            NEW.points,
            NEW.assigned_to,
            NEW.created_by,
            NEW.start_date,
            true,
            NEW.id
        );
        
        -- Update the series with the next due date (use qualified column references)
        UPDATE public.task_series 
        SET 
            last_generated_date = NEW.next_due_date,
            next_due_date = CASE NEW.recurring_frequency
                WHEN 'daily' THEN NEW.next_due_date + (NEW.recurring_interval || ' days')::INTERVAL
                WHEN 'weekly' THEN NEW.next_due_date + (NEW.recurring_interval * 7 || ' days')::INTERVAL
                WHEN 'monthly' THEN NEW.next_due_date + (NEW.recurring_interval || ' months')::INTERVAL
            END
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;