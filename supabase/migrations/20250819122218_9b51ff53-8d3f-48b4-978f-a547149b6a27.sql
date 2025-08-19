-- Drop triggers first, then functions, then recreate with proper security
DROP TRIGGER IF EXISTS trigger_generate_initial_recurring_task ON public.task_series;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_families_updated_at ON public.families;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
DROP TRIGGER IF EXISTS update_task_series_updated_at ON public.task_series;

-- Drop functions
DROP FUNCTION IF EXISTS generate_initial_recurring_task();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate update_updated_at_column with proper security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recreate handle_new_user with proper security
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
    family_name TEXT;
    new_family_id UUID;
BEGIN
    -- Extract family name from metadata or use default
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    
    -- Create family first
    INSERT INTO public.families (name) 
    VALUES (family_name)
    RETURNING id INTO new_family_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        new_family_id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        'parent'::public.user_role
    );
    
    RETURN NEW;
END;
$$;

-- Recreate generate_initial_recurring_task with proper security
CREATE OR REPLACE FUNCTION generate_initial_recurring_task()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Recreate all triggers
CREATE TRIGGER trigger_generate_initial_recurring_task
AFTER INSERT ON public.task_series
FOR EACH ROW
EXECUTE FUNCTION generate_initial_recurring_task();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW 
EXECUTE FUNCTION public.handle_new_user();

-- Recreate update triggers  
CREATE TRIGGER update_families_updated_at
BEFORE UPDATE ON public.families
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_series_updated_at
BEFORE UPDATE ON public.task_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();