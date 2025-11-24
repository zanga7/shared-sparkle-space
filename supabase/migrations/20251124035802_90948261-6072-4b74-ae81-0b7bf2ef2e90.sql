-- Drop previous functions
DROP FUNCTION IF EXISTS get_oauth_credentials();
DROP FUNCTION IF EXISTS update_oauth_credentials(JSON);

-- Create a secrets table for OAuth credentials (encrypted)
CREATE TABLE IF NOT EXISTS oauth_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT, -- Will be encrypted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on oauth_secrets
ALTER TABLE oauth_secrets ENABLE ROW LEVEL SECURITY;

-- Only super admins can access oauth_secrets
CREATE POLICY "super_admins_manage_oauth_secrets" ON oauth_secrets
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Function to get OAuth credentials (super admins only)
CREATE OR REPLACE FUNCTION get_oauth_credentials()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  google_client_id TEXT;
  google_client_secret TEXT;
  microsoft_client_id TEXT;
  microsoft_client_secret TEXT;
BEGIN
  -- Check if user is super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Get OAuth credentials from the secrets table
  SELECT value INTO google_client_id FROM oauth_secrets WHERE key = 'google_client_id';
  SELECT value INTO google_client_secret FROM oauth_secrets WHERE key = 'google_client_secret';
  SELECT value INTO microsoft_client_id FROM oauth_secrets WHERE key = 'microsoft_client_id';
  SELECT value INTO microsoft_client_secret FROM oauth_secrets WHERE key = 'microsoft_client_secret';

  -- Return OAuth credentials, masking secrets
  SELECT json_build_object(
    'google_client_id', google_client_id,
    'google_client_secret', CASE 
      WHEN google_client_secret IS NOT NULL AND google_client_secret != '' 
      THEN '********' 
      ELSE NULL 
    END,
    'microsoft_client_id', microsoft_client_id,
    'microsoft_client_secret', CASE 
      WHEN microsoft_client_secret IS NOT NULL AND microsoft_client_secret != '' 
      THEN '********' 
      ELSE NULL 
    END
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to update OAuth credentials (super admins only)
CREATE OR REPLACE FUNCTION update_oauth_credentials(credentials JSON)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    INSERT INTO oauth_secrets (key, value, updated_at)
    VALUES ('google_client_id', google_client_id, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  END IF;
  
  IF google_client_secret IS NOT NULL AND google_client_secret != '********' THEN
    INSERT INTO oauth_secrets (key, value, updated_at)
    VALUES ('google_client_secret', google_client_secret, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  END IF;

  -- Update Microsoft credentials if provided
  IF microsoft_client_id IS NOT NULL THEN
    INSERT INTO oauth_secrets (key, value, updated_at)
    VALUES ('microsoft_client_id', microsoft_client_id, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  END IF;
  
  IF microsoft_client_secret IS NOT NULL AND microsoft_client_secret != '********' THEN
    INSERT INTO oauth_secrets (key, value, updated_at)
    VALUES ('microsoft_client_secret', microsoft_client_secret, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  END IF;

  RETURN json_build_object('success', true, 'message', 'OAuth credentials updated successfully');
END;
$$;

-- Function for edge functions to get OAuth credentials
CREATE OR REPLACE FUNCTION get_oauth_credential(credential_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credential_value TEXT;
BEGIN
  SELECT value INTO credential_value FROM oauth_secrets WHERE key = credential_key;
  RETURN credential_value;
END;
$$;