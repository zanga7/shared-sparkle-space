-- Enable pgcrypto extension for secure PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix missing RLS policies for critical security gaps

-- 1. Add UPDATE policy for task_completions to prevent unauthorized modifications
CREATE POLICY "Parents can approve task completions" 
ON public.task_completions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 
  FROM tasks 
  JOIN profiles ON profiles.family_id = tasks.family_id 
  WHERE tasks.id = task_completions.task_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'::user_role
));

-- 2. Add INSERT policy for families table to control family creation
CREATE POLICY "Authenticated users can create families" 
ON public.families 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Add DELETE policy for profiles table to prevent unauthorized profile deletion
CREATE POLICY "Parents can delete family member profiles" 
ON public.profiles 
FOR DELETE 
USING (EXISTS (
  SELECT 1 
  FROM profiles p2 
  WHERE p2.family_id = profiles.family_id 
  AND p2.user_id = auth.uid() 
  AND p2.role = 'parent'::user_role
));

-- 4. Update database functions to include proper search_path settings for SQL injection prevention

-- Update get_user_family_id function
CREATE OR REPLACE FUNCTION public.get_user_family_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Update is_current_user_parent function
CREATE OR REPLACE FUNCTION public.is_current_user_parent()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'parent'
  );
$function$;

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
$function$;

-- Update generate_initial_recurring_task function
CREATE OR REPLACE FUNCTION public.generate_initial_recurring_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Update create_audit_log function
CREATE OR REPLACE FUNCTION public.create_audit_log(p_family_id uuid, p_actor_id uuid, p_action text, p_entity_type text, p_entity_id uuid DEFAULT NULL::uuid, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    p_family_id,
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data
  );
END;
$function$;

-- Update audit_trigger_function
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

-- Add PIN validation function for child profiles
CREATE OR REPLACE FUNCTION public.validate_child_pin(profile_id uuid, pin_input text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stored_hash text;
  is_locked boolean;
  lock_until timestamp with time zone;
  max_attempts integer;
  lockout_duration integer;
BEGIN
  -- Get profile data and settings
  SELECT 
    p.pin_hash,
    p.pin_locked_until,
    hs.pin_attempts_limit,
    hs.pin_lockout_duration
  INTO 
    stored_hash,
    lock_until,
    max_attempts,
    lockout_duration
  FROM public.profiles p
  JOIN public.household_settings hs ON hs.family_id = p.family_id
  WHERE p.id = profile_id AND p.user_id IS NULL; -- Only for child profiles
  
  -- Check if profile exists and has PIN
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if account is locked
  IF lock_until IS NOT NULL AND lock_until > now() THEN
    RETURN false;
  END IF;
  
  -- Validate PIN
  IF crypt(pin_input, stored_hash) = stored_hash THEN
    -- Reset failed attempts on successful login
    UPDATE public.profiles 
    SET failed_pin_attempts = 0, pin_locked_until = NULL
    WHERE id = profile_id;
    RETURN true;
  ELSE
    -- Increment failed attempts
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = failed_pin_attempts + 1,
      pin_locked_until = CASE 
        WHEN failed_pin_attempts + 1 >= max_attempts 
        THEN now() + (lockout_duration * interval '1 second')
        ELSE NULL
      END
    WHERE id = profile_id;
    RETURN false;
  END IF;
END;
$function$;

-- Add function to hash PINs
CREATE OR REPLACE FUNCTION public.hash_pin(pin_input text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT crypt(pin_input, gen_salt('bf', 10));
$function$;