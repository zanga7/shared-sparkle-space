-- Phase 2: Enhanced RLS policies and token masking
-- Create secure view for calendar integrations without exposing raw tokens

CREATE OR REPLACE VIEW public.calendar_integrations_secure AS
SELECT 
  id,
  profile_id,
  integration_type,
  calendar_id,
  is_active,
  created_at,
  updated_at,
  expires_at,
  last_token_refresh,
  token_refresh_count,
  created_ip,
  last_access_ip,
  security_flags,
  -- Show masked token indicators instead of raw tokens
  CASE 
    WHEN access_token IS NOT NULL THEN 'ENCRYPTED_TOKEN_SET'
    ELSE NULL 
  END as access_token_status,
  CASE 
    WHEN refresh_token IS NOT NULL THEN 'ENCRYPTED_TOKEN_SET'
    ELSE NULL 
  END as refresh_token_status,
  -- Token expiration status
  CASE 
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN true
    ELSE false
  END as is_token_expired
FROM public.calendar_integrations;

-- Enhanced RLS policies for the secure view
ALTER VIEW public.calendar_integrations_secure SET (security_barrier = true);

-- Create policy for secure view access
CREATE OR REPLACE FUNCTION public.can_access_calendar_integration(integration_profile_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  integration_family_id UUID;
  user_family_id UUID;
BEGIN
  -- Get current user's profile
  SELECT id, family_id INTO user_profile_id, user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get integration's family
  SELECT family_id INTO integration_family_id
  FROM public.profiles 
  WHERE id = integration_profile_id;
  
  -- Allow access if same family
  RETURN user_family_id = integration_family_id;
END;
$$;

-- Update existing calendar integrations RLS policies to be more restrictive
DROP POLICY IF EXISTS "Users can view their own calendar integrations only" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can insert their own calendar integrations only" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can update their own calendar integrations only" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can delete their own calendar integrations only" ON public.calendar_integrations;

-- Create new restrictive policies that prevent direct token access
CREATE POLICY "Restrict calendar integration access" 
ON public.calendar_integrations 
FOR ALL
USING (false)
WITH CHECK (false);

-- Create secure functions for calendar integration management
CREATE OR REPLACE FUNCTION public.create_calendar_integration(
  integration_type_param TEXT,
  calendar_id_param TEXT,
  access_token_param TEXT,
  refresh_token_param TEXT DEFAULT NULL,
  expires_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  new_integration_id UUID;
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
BEGIN
  -- Get current user's profile
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Encrypt tokens
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'access');
  
  IF refresh_token_param IS NOT NULL THEN
    encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'refresh');
  END IF;

  -- Create integration with encrypted tokens
  INSERT INTO public.calendar_integrations (
    profile_id,
    integration_type,
    calendar_id,
    access_token,
    refresh_token,
    expires_at,
    created_ip
  ) VALUES (
    user_profile_id,
    integration_type_param,
    calendar_id_param,
    encrypted_access_token,
    encrypted_refresh_token,
    expires_at_param,
    inet_client_addr()
  ) RETURNING id INTO new_integration_id;

  -- Log secure integration creation
  PERFORM public.create_audit_log(
    (SELECT family_id FROM public.profiles WHERE id = user_profile_id),
    auth.uid(),
    'calendar_integration_created',
    'calendar_integrations',
    new_integration_id,
    NULL,
    json_build_object(
      'integration_type', integration_type_param,
      'calendar_id', calendar_id_param,
      'encrypted', true,
      'created_at', NOW()
    )
  );

  RETURN json_build_object(
    'success', true, 
    'integration_id', new_integration_id,
    'message', 'Calendar integration created with encrypted tokens'
  );
END;
$$;

-- Secure function to get integration info without exposing tokens
CREATE OR REPLACE FUNCTION public.get_user_calendar_integrations()
RETURNS TABLE(
  id UUID,
  integration_type TEXT,
  calendar_id TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_token_expired BOOLEAN,
  last_token_refresh TIMESTAMP WITH TIME ZONE,
  token_refresh_count INTEGER,
  has_access_token BOOLEAN,
  has_refresh_token BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
BEGIN
  -- Get current user's profile
  SELECT p.id INTO user_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN QUERY
  SELECT 
    ci.id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at,
    (ci.expires_at IS NOT NULL AND ci.expires_at < NOW()) as is_token_expired,
    ci.last_token_refresh,
    ci.token_refresh_count,
    (ci.access_token IS NOT NULL) as has_access_token,
    (ci.refresh_token IS NOT NULL) as has_refresh_token
  FROM public.calendar_integrations ci
  WHERE ci.profile_id = user_profile_id
  ORDER BY ci.created_at DESC;
END;
$$;

-- Function to safely delete calendar integration
CREATE OR REPLACE FUNCTION public.delete_calendar_integration(integration_id_param UUID)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  integration_exists BOOLEAN;
BEGIN
  -- Get current user's profile
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Verify ownership and delete
  DELETE FROM public.calendar_integrations 
  WHERE id = integration_id_param 
  AND profile_id = user_profile_id;
  
  GET DIAGNOSTICS integration_exists = ROW_COUNT;

  IF integration_exists THEN
    -- Log deletion
    PERFORM public.create_audit_log(
      (SELECT family_id FROM public.profiles WHERE id = user_profile_id),
      auth.uid(),
      'calendar_integration_deleted',
      'calendar_integrations',
      integration_id_param,
      NULL,
      json_build_object('deleted_at', NOW(), 'reason', 'user_requested')
    );
    
    RETURN json_build_object('success', true, 'message', 'Integration deleted successfully');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Integration not found or access denied');
  END IF;
END;
$$;