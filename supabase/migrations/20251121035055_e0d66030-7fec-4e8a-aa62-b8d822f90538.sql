-- Drop the old function
DROP FUNCTION IF EXISTS public.create_secure_calendar_integration(text, text, text, text, timestamptz);

-- Create updated function that accepts profile_id parameter
CREATE OR REPLACE FUNCTION public.create_secure_calendar_integration(
  integration_type_param TEXT,
  calendar_id_param TEXT,
  access_token_param TEXT,
  refresh_token_param TEXT DEFAULT NULL,
  expires_at_param TIMESTAMPTZ DEFAULT NULL,
  target_profile_id_param UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  target_profile_id UUID;
  user_family_id UUID;
  target_family_id UUID;
  user_role TEXT;
  new_integration_id UUID;
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
BEGIN
  -- Get current user's profile, family, and role
  SELECT p.id, p.family_id, p.role INTO user_profile_id, user_family_id, user_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Determine target profile (either specified or current user)
  IF target_profile_id_param IS NULL THEN
    target_profile_id := user_profile_id;
  ELSE
    target_profile_id := target_profile_id_param;
    
    -- Get target profile's family
    SELECT p.family_id INTO target_family_id
    FROM public.profiles p
    WHERE p.id = target_profile_id;
    
    IF target_family_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Target profile not found');
    END IF;
    
    -- Verify user has permission to create integration for target profile
    -- Either creating for themselves OR is a parent in the same family
    IF target_profile_id != user_profile_id AND (user_role != 'parent' OR user_family_id != target_family_id) THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
  END IF;

  -- Rate limiting: Check for too many recent integrations
  IF (
    SELECT COUNT(*) 
    FROM public.calendar_integrations ci
    WHERE ci.profile_id = target_profile_id
    AND ci.created_at > now() - INTERVAL '1 hour'
  ) >= 5 THEN
    RETURN json_build_object('success', false, 'error', 'Rate limit exceeded');
  END IF;

  -- Validate input parameters
  IF access_token_param IS NULL OR length(access_token_param) < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid access token');
  END IF;

  -- Encrypt tokens immediately
  BEGIN
    encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'access');
    
    IF refresh_token_param IS NOT NULL THEN
      encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'refresh');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Token encryption failed: ' || SQLERRM);
  END;

  -- Create integration record with encrypted tokens for target profile
  INSERT INTO public.calendar_integrations (
    profile_id,
    integration_type,
    calendar_id,
    access_token,
    refresh_token,
    expires_at,
    created_ip,
    security_flags
  ) VALUES (
    target_profile_id,
    integration_type_param,
    calendar_id_param,
    encrypted_access_token,
    encrypted_refresh_token,
    expires_at_param,
    inet_client_addr(),
    jsonb_build_object(
      'created_securely', true,
      'encrypted_at', now(),
      'encryption_version', '2.0',
      'created_via', 'secure_function',
      'created_by_profile', user_profile_id
    )
  ) RETURNING id INTO new_integration_id;

  -- Log secure creation
  PERFORM public.log_sensitive_access(
    'calendar_integrations',
    new_integration_id,
    'secure_integration_created',
    true,
    json_build_object(
      'integration_type', integration_type_param,
      'encrypted', true,
      'function_version', '2.1',
      'created_for_profile', target_profile_id,
      'created_by_profile', user_profile_id
    )
  );

  RETURN json_build_object(
    'success', true, 
    'integration_id', new_integration_id,
    'message', 'Calendar integration created with encryption'
  );
END;
$$;