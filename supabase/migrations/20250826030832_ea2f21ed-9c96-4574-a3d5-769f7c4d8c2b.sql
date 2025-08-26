-- Fix critical database security issues

-- 1. Fix calendar integrations RLS policy to allow proper owner access
DROP POLICY IF EXISTS "Restrict calendar integration access" ON public.calendar_integrations;

CREATE POLICY "Users can manage their own calendar integrations"
ON public.calendar_integrations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- 2. Secure all database functions by setting search_path
-- Update all functions to include SET search_path TO 'public'

CREATE OR REPLACE FUNCTION public.revoke_reward_request(request_id_param uuid, revoke_note_param text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  revoker_profile_id UUID;
BEGIN
  -- Get revoker's profile (must be parent)
  SELECT id INTO revoker_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF revoker_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can revoke requests');
  END IF;

  -- Get request details
  SELECT rr.*, r.title as reward_title, r.family_id
  INTO request_record
  FROM public.reward_requests rr
  JOIN public.rewards r ON r.id = rr.reward_id
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE rr.id = request_id_param 
  AND rr.status = 'approved'
  AND p.id = revoker_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;

  -- Update request status to cancelled
  UPDATE public.reward_requests 
  SET 
    status = 'cancelled',
    approval_note = COALESCE(revoke_note_param, 'Reward revoked and points refunded'),
    updated_at = NOW()
  WHERE id = request_id_param;

  -- Refund points by updating total_points directly
  UPDATE public.profiles
  SET total_points = total_points + request_record.points_cost
  WHERE id = request_record.requested_by;

  -- Create ledger entry for refund
  INSERT INTO public.points_ledger (
    profile_id,
    family_id,
    entry_type,
    points,
    reason,
    reward_request_id,
    created_by
  ) VALUES (
    request_record.requested_by,
    request_record.family_id,
    'adjust',
    request_record.points_cost,
    'Reward refund: ' || request_record.reward_title,
    request_id_param,
    revoker_profile_id
  );

  RETURN json_build_object('success', true, 'message', 'Reward revoked and points refunded');
END;
$function$;

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

-- 3. Enhance list_templates security to require authentication for global templates
DROP POLICY IF EXISTS "Family members can view templates" ON public.list_templates;

CREATE POLICY "Authenticated users can view templates"
ON public.list_templates
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    is_global = true OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.family_id = list_templates.family_id 
      AND profiles.user_id = auth.uid()
    )
  )
);

-- 4. Add rate limiting for PIN authentication attempts
CREATE OR REPLACE FUNCTION public.authenticate_child_pin(profile_id_param uuid, pin_attempt text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  new_failed_attempts INTEGER;
  max_attempts INTEGER := 3;
  lockout_duration INTEGER := 300; -- 5 minutes
  recent_attempts INTEGER;
BEGIN
  -- Rate limiting: Check for too many recent attempts
  SELECT COUNT(*) INTO recent_attempts
  FROM public.audit_logs
  WHERE entity_type = 'profiles'
  AND entity_id = profile_id_param
  AND action = 'child_pin_auth_failed'
  AND created_at > NOW() - INTERVAL '15 minutes';

  IF recent_attempts >= 10 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Too many recent attempts. Please wait 15 minutes.',
      'rate_limited', true
    );
  END IF;

  -- Get profile and household settings
  SELECT p.*, hs.pin_attempts_limit, hs.pin_lockout_duration
  INTO profile_record
  FROM public.profiles p
  LEFT JOIN public.household_settings hs ON hs.family_id = p.family_id
  WHERE p.id = profile_id_param 
  AND p.user_id IS NULL 
  AND p.status = 'active';

  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Use household settings or defaults
  max_attempts := COALESCE(profile_record.pin_attempts_limit, 3);
  lockout_duration := COALESCE(profile_record.pin_lockout_duration, 300);

  -- Check if profile is locked
  IF profile_record.pin_locked_until IS NOT NULL AND 
     profile_record.pin_locked_until > NOW() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Account locked. Try again later.',
      'locked_until', profile_record.pin_locked_until
    );
  END IF;

  -- Check if PIN hash exists
  IF profile_record.pin_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PIN not set for this profile');
  END IF;

  -- Verify PIN using secure hash comparison
  IF public.verify_pin(pin_attempt, profile_record.pin_hash) THEN
    -- Reset failed attempts on successful login
    UPDATE public.profiles 
    SET failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = NOW()
    WHERE id = profile_id_param;

    -- Log successful authentication
    PERFORM public.create_audit_log(
      profile_record.family_id,
      profile_record.id,
      'child_pin_auth_success',
      'profiles',
      profile_record.id,
      NULL,
      json_build_object('authenticated_at', NOW())
    );

    RETURN json_build_object('success', true, 'profile_id', profile_id_param);
  ELSE
    -- Increment failed attempts
    new_failed_attempts := COALESCE(profile_record.failed_pin_attempts, 0) + 1;
    
    -- Check if account should be locked
    IF new_failed_attempts >= max_attempts THEN
      UPDATE public.profiles 
      SET 
        failed_pin_attempts = new_failed_attempts,
        pin_locked_until = NOW() + (lockout_duration || ' seconds')::INTERVAL,
        updated_at = NOW()
      WHERE id = profile_id_param;

      -- Log lockout
      PERFORM public.create_audit_log(
        profile_record.family_id,
        profile_record.id,
        'child_pin_lockout',
        'profiles',
        profile_record.id,
        NULL,
        json_build_object('locked_at', NOW(), 'attempts', new_failed_attempts)
      );

      RETURN json_build_object(
        'success', false, 
        'error', 'Account locked due to too many failed attempts',
        'locked_until', NOW() + (lockout_duration || ' seconds')::INTERVAL
      );
    ELSE
      UPDATE public.profiles 
      SET failed_pin_attempts = new_failed_attempts, updated_at = NOW()
      WHERE id = profile_id_param;

      -- Log failed attempt
      PERFORM public.create_audit_log(
        profile_record.family_id,
        profile_record.id,
        'child_pin_auth_failed',
        'profiles',
        profile_record.id,
        NULL,
        json_build_object('failed_at', NOW(), 'attempts', new_failed_attempts)
      );

      RETURN json_build_object(
        'success', false, 
        'error', 'Invalid PIN', 
        'attempts_remaining', max_attempts - new_failed_attempts
      );
    END IF;
  END IF;
END;
$function$;