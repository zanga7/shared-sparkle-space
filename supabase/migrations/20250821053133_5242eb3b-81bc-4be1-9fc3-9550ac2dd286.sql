-- Fix the delete_reward function first
CREATE OR REPLACE FUNCTION delete_reward(reward_id_param UUID)
RETURNS TABLE(success BOOLEAN, error TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if reward exists and belongs to user's family
    IF NOT EXISTS (
        SELECT 1 FROM rewards r
        JOIN profiles p ON r.family_id = p.family_id
        WHERE r.id = reward_id_param 
        AND p.user_id = auth.uid()
    ) THEN
        RETURN QUERY SELECT FALSE, 'Reward not found or access denied'::TEXT, ''::TEXT;
        RETURN;
    END IF;

    -- Delete the reward
    DELETE FROM rewards WHERE id = reward_id_param;
    
    RETURN QUERY SELECT TRUE, ''::TEXT, 'Reward deleted successfully'::TEXT;
END;
$$;

-- Fix the generate_recurring_tasks edge function by updating the task generation logic
-- The issue is with next_due_date being ambiguous in the SQL query

-- First let's create a proper RPC function to handle task series creation without ambiguity
CREATE OR REPLACE FUNCTION create_task_series_with_first_task(
    family_id_param UUID,
    title_param TEXT,
    description_param TEXT,
    points_param INTEGER,
    assigned_to_param UUID,
    created_by_param UUID,
    recurring_frequency_param TEXT,
    recurring_interval_param INTEGER,
    recurring_days_of_week_param INTEGER[],
    recurring_end_date_param TIMESTAMP WITH TIME ZONE,
    start_date_param TIMESTAMP WITH TIME ZONE,
    repetition_count_param INTEGER,
    remaining_repetitions_param INTEGER,
    monthly_type_param TEXT,
    monthly_weekday_ordinal_param INTEGER
)
RETURNS TABLE(success BOOLEAN, error TEXT, series_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_series_id UUID;
    first_task_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate the first due date based on start date
    first_task_due_date := start_date_param;
    
    -- Create the task series
    INSERT INTO task_series (
        family_id,
        title,
        description,
        points,
        assigned_to,
        created_by,
        recurring_frequency,
        recurring_interval,
        recurring_days_of_week,
        recurring_end_date,
        start_date,
        next_due_date,
        repetition_count,
        remaining_repetitions,
        monthly_type,
        monthly_weekday_ordinal,
        is_active
    ) VALUES (
        family_id_param,
        title_param,
        description_param,
        points_param,
        assigned_to_param,
        created_by_param,
        recurring_frequency_param,
        recurring_interval_param,
        recurring_days_of_week_param,
        recurring_end_date_param,
        start_date_param,
        first_task_due_date,
        repetition_count_param,
        remaining_repetitions_param,
        monthly_type_param,
        monthly_weekday_ordinal_param,
        true
    ) RETURNING id INTO new_series_id;

    -- Create the first task instance
    INSERT INTO tasks (
        family_id,
        title,
        description,
        points,
        assigned_to,
        due_date,
        created_by,
        is_repeating,
        task_series_id
    ) VALUES (
        family_id_param,
        title_param,
        description_param,
        points_param,
        assigned_to_param,
        first_task_due_date,
        created_by_param,
        true,
        new_series_id
    );

    RETURN QUERY SELECT TRUE, ''::TEXT, new_series_id;
END;
$$;