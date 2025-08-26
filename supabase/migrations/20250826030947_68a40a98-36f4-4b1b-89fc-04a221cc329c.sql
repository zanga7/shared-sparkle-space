-- Continue fixing remaining database functions to set search_path

CREATE OR REPLACE FUNCTION public.award_task_completion_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  task_record RECORD;
  profile_record RECORD;
BEGIN
  -- Get task details
  SELECT t.*, p.family_id
  INTO task_record
  FROM public.tasks t
  JOIN public.profiles p ON p.id = t.created_by
  WHERE t.id = NEW.task_id;

  -- Get the completing profile's family
  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE id = NEW.completed_by;

  -- Only award points if task and profile are in the same family
  IF task_record.family_id = profile_record.family_id THEN
    -- Create ledger entry for earning points
    INSERT INTO public.points_ledger (
      profile_id,
      family_id,
      entry_type,
      points,
      reason,
      task_id,
      created_by
    ) VALUES (
      NEW.completed_by,
      profile_record.family_id,
      'earn',
      NEW.points_earned,
      'Task completed: ' || task_record.title,
      NEW.task_id,
      NEW.completed_by
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_group_contribution_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reward_record RECORD;
  contribution_count INTEGER;
  required_contributors INTEGER;
  assigned_member_id UUID;
BEGIN
  -- Get the reward details
  SELECT * INTO reward_record
  FROM public.rewards 
  WHERE id = NEW.reward_id AND reward_type = 'group_contribution';
  
  -- If not a group contribution reward, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get required number of contributors (based on assigned_to array length, or 1 if null)
  required_contributors := COALESCE(array_length(reward_record.assigned_to, 1), 1);
  
  -- Count unique contributors who have contributed the full amount
  SELECT COUNT(DISTINCT profile_id) INTO contribution_count
  FROM public.group_contributions
  WHERE reward_id = NEW.reward_id 
  AND points_contributed >= reward_record.cost_points;
  
  -- If we have enough contributors, mark reward as inactive and create approval for all members
  IF contribution_count >= required_contributors THEN
    -- Deactivate the reward
    UPDATE public.rewards 
    SET is_active = false, updated_at = NOW()
    WHERE id = NEW.reward_id;
    
    -- Create reward requests for all assigned members with 'approved' status
    IF reward_record.assigned_to IS NOT NULL THEN
      -- Loop through all assigned members
      FOREACH assigned_member_id IN ARRAY reward_record.assigned_to
      LOOP
        INSERT INTO public.reward_requests (
          reward_id,
          requested_by,
          points_cost,
          status,
          approval_note,
          created_at,
          updated_at
        ) VALUES (
          NEW.reward_id,
          assigned_member_id,
          0, -- No points cost as they've already been deducted via contributions
          'approved',
          'Group contribution goal completed automatically',
          NOW(),
          NOW()
        );
      END LOOP;
    ELSE
      -- Fallback: create one request for the completing contributor
      INSERT INTO public.reward_requests (
        reward_id,
        requested_by,
        points_cost,
        status,
        approval_note,
        created_at,
        updated_at
      ) VALUES (
        NEW.reward_id,
        NEW.profile_id,
        0,
        'approved',
        'Group contribution goal completed automatically',
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  family_id_val UUID;
  actor_id_val UUID;
BEGIN
  -- Get family_id from the record
  IF TG_TABLE_NAME = 'profiles' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'task_series' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'categories' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  END IF;

  -- Get actor_id (current user)
  actor_id_val := auth.uid();

  -- Create audit log entry
  IF TG_OP = 'DELETE' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD),
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'update',
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'create',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_token_refresh()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If access_token changed, track the refresh
  IF OLD.access_token IS DISTINCT FROM NEW.access_token THEN
    NEW.last_token_refresh = now();
    NEW.token_refresh_count = COALESCE(OLD.token_refresh_count, 0) + 1;
    
    -- Log the refresh
    PERFORM public.log_calendar_token_access(NEW.id, 'refresh', true);
  END IF;
  
  RETURN NEW;
END;
$function$;