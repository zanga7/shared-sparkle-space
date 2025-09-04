-- Security Fix: Complete Database Function Hardening
-- Fix remaining functions missing search_path security settings

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
DECLARE
    family_name TEXT;
    new_family_id UUID;
    display_name TEXT;
BEGIN
    -- Extract info from user metadata with fallbacks
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    display_name := COALESCE(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Create family first
    INSERT INTO public.families (name) 
    VALUES (family_name)
    RETURNING id INTO new_family_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        new_family_id,
        display_name,
        'parent'::public.user_role
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        -- The user can fix their profile later using the fix function
        RETURN NEW;
END;
$function$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Update handle_group_contribution_completion function
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

-- Update track_token_refresh function
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

-- Update is_parent_in_same_family function (complete the function that was truncated)
CREATE OR REPLACE FUNCTION public.is_parent_in_same_family(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_family_id UUID;
  target_family_id UUID;
  is_parent BOOLEAN;
BEGIN
  -- Get current user's family and role
  SELECT family_id, (role = 'parent') INTO current_user_family_id, is_parent
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  -- Must be a parent
  IF NOT is_parent THEN
    RETURN false;
  END IF;
  
  -- Get target profile's family
  SELECT family_id INTO target_family_id
  FROM public.profiles 
  WHERE id = target_profile_id;
  
  -- Must be in same family
  RETURN current_user_family_id = target_family_id;
END;
$function$;

-- Update all SQL stable functions to include proper search_path
CREATE OR REPLACE FUNCTION public.get_profile_points_balance(profile_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(points), 0)
  FROM public.points_ledger
  WHERE profile_id = profile_id_param;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result UUID;
BEGIN
  SELECT family_id INTO result 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Use a direct query that shouldn't cause recursion
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_current_user_parent()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result boolean;
BEGIN
  SELECT (role = 'parent') INTO result
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  RETURN COALESCE(result, false);
END;
$function$;