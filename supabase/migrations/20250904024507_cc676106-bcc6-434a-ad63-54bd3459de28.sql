-- Security Fix: Final remaining functions
-- Fix the last functions missing search_path security settings

CREATE OR REPLACE FUNCTION public.create_first_task_from_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    UPDATE public.task_series 
    SET 
        last_generated_date = COALESCE(NEW.start_date::date, CURRENT_DATE),
        next_due_date = calculated_next_due_date
    WHERE id = NEW.id;

    -- Create the first task instance
    INSERT INTO public.tasks (
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_initial_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;