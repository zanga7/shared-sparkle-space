-- Dashboard Mode Schema Updates

-- Add new columns to profiles table for dashboard permissions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS require_pin_to_complete_tasks BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_pin_for_list_deletes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS calendar_edit_permission TEXT DEFAULT 'open' CHECK (calendar_edit_permission IN ('open', 'require_pin'));

-- Create dashboard_sessions table to track active member sessions
CREATE TABLE IF NOT EXISTS public.dashboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  active_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pin_cache_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id)
);

-- Enable RLS on dashboard_sessions
ALTER TABLE public.dashboard_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for dashboard_sessions
CREATE POLICY "Family members can view dashboard sessions" 
ON public.dashboard_sessions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = dashboard_sessions.active_member_id 
  AND family_id = get_current_user_family_id()
));

CREATE POLICY "Family members can manage dashboard sessions" 
ON public.dashboard_sessions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = dashboard_sessions.active_member_id 
  AND family_id = get_current_user_family_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = dashboard_sessions.active_member_id 
  AND family_id = get_current_user_family_id()
));

-- Add dashboard mode settings to household_settings
ALTER TABLE public.household_settings
ADD COLUMN IF NOT EXISTS dashboard_mode_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_return_timeout_minutes INTEGER DEFAULT 10;

-- Create trigger for dashboard_sessions updated_at
CREATE TRIGGER update_dashboard_sessions_updated_at
  BEFORE UPDATE ON public.dashboard_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to authenticate member PIN for dashboard actions
CREATE OR REPLACE FUNCTION public.authenticate_member_pin_dashboard(
  profile_id_param UUID,
  pin_attempt TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  stored_pin_hash TEXT;
  member_record RECORD;
  family_id_val UUID;
BEGIN
  -- Get member details and verify family access
  SELECT p.*, p.family_id INTO member_record
  FROM public.profiles p
  WHERE p.id = profile_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  -- Verify family access
  family_id_val := get_current_user_family_id();
  IF member_record.family_id != family_id_val THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Check if PIN is required
  IF member_record.pin_hash IS NULL THEN
    RETURN json_build_object('success', true, 'message', 'No PIN required');
  END IF;
  
  -- Check lockout status
  IF member_record.pin_locked_until IS NOT NULL AND member_record.pin_locked_until > now() THEN
    RETURN json_build_object('success', false, 'error', 'Account temporarily locked');
  END IF;
  
  -- Verify PIN
  stored_pin_hash := member_record.pin_hash;
  
  IF stored_pin_hash = crypt(pin_attempt, stored_pin_hash) THEN
    -- Success: reset failed attempts and update cache
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = 0,
      pin_locked_until = NULL
    WHERE id = profile_id_param;
    
    -- Update or create dashboard session with PIN cache
    INSERT INTO public.dashboard_sessions (device_id, active_member_id, pin_cache_expires)
    VALUES (
      COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown'),
      profile_id_param,
      now() + INTERVAL '5 minutes'
    )
    ON CONFLICT (device_id) DO UPDATE SET
      active_member_id = profile_id_param,
      pin_cache_expires = now() + INTERVAL '5 minutes',
      last_activity = now(),
      updated_at = now();
    
    RETURN json_build_object('success', true, 'message', 'PIN verified');
  ELSE
    -- Failed PIN: increment attempts
    UPDATE public.profiles 
    SET 
      failed_pin_attempts = failed_pin_attempts + 1,
      pin_locked_until = CASE 
        WHEN failed_pin_attempts + 1 >= 3 THEN now() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE id = profile_id_param;
    
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;
END;
$$;

-- Create function to check if member can perform action without PIN (cache check)
CREATE OR REPLACE FUNCTION public.check_member_pin_cache(
  profile_id_param UUID,
  device_id_param TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cache_valid BOOLEAN := false;
  actual_device_id TEXT;
BEGIN
  -- Use provided device_id or derive from headers
  actual_device_id := COALESCE(
    device_id_param, 
    current_setting('request.headers', true)::json->>'user-agent',
    'unknown'
  );
  
  -- Check if there's a valid PIN cache for this member and device
  SELECT EXISTS (
    SELECT 1 
    FROM public.dashboard_sessions 
    WHERE device_id = actual_device_id
    AND active_member_id = profile_id_param
    AND pin_cache_expires > now()
  ) INTO cache_valid;
  
  RETURN cache_valid;
END;
$$;