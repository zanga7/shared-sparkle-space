-- Create function to get OAuth credentials (super admins only)
CREATE OR REPLACE FUNCTION get_oauth_credentials()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if user is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Return OAuth credentials from secrets
  SELECT json_build_object(
    'google_client_id', current_setting('app.google_client_id', true),
    'google_client_secret', CASE 
      WHEN current_setting('app.google_client_secret', true) IS NOT NULL 
      THEN '********' -- Mask the secret
      ELSE NULL 
    END,
    'microsoft_client_id', current_setting('app.microsoft_client_id', true),
    'microsoft_client_secret', CASE 
      WHEN current_setting('app.microsoft_client_secret', true) IS NOT NULL 
      THEN '********' -- Mask the secret
      ELSE NULL 
    END
  ) INTO result;

  RETURN result;
END;
$$;

-- Create function to update OAuth credentials (super admins only)
CREATE OR REPLACE FUNCTION update_oauth_credentials(credentials JSON)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  google_client_id TEXT;
  google_client_secret TEXT;
  microsoft_client_id TEXT;
  microsoft_client_secret TEXT;
BEGIN
  -- Check if user is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Extract values from JSON
  google_client_id := credentials->>'google_client_id';
  google_client_secret := credentials->>'google_client_secret';
  microsoft_client_id := credentials->>'microsoft_client_id';
  microsoft_client_secret := credentials->>'microsoft_client_secret';

  -- Update Google credentials if provided
  IF google_client_id IS NOT NULL THEN
    PERFORM set_config('app.google_client_id', google_client_id, false);
  END IF;
  
  IF google_client_secret IS NOT NULL AND google_client_secret != '********' THEN
    PERFORM set_config('app.google_client_secret', google_client_secret, false);
  END IF;

  -- Update Microsoft credentials if provided
  IF microsoft_client_id IS NOT NULL THEN
    PERFORM set_config('app.microsoft_client_id', microsoft_client_id, false);
  END IF;
  
  IF microsoft_client_secret IS NOT NULL AND microsoft_client_secret != '********' THEN
    PERFORM set_config('app.microsoft_client_secret', microsoft_client_secret, false);
  END IF;

  RETURN json_build_object('success', true, 'message', 'OAuth credentials updated successfully');
END;
$$;