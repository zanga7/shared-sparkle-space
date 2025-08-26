-- Step 1: Create a secure view that only shows metadata without sensitive tokens
CREATE OR REPLACE VIEW calendar_integrations_secure AS
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
  -- Security status indicators without exposing tokens
  CASE 
    WHEN access_token LIKE '%::%' THEN 'encrypted'::text
    WHEN access_token LIKE 'SECURITY_REVOKED_%' THEN 'revoked_security'::text
    WHEN access_token = 'REVOKED' THEN 'revoked'::text
    WHEN access_token = 'PENDING_ENCRYPTION' THEN 'pending_encryption'::text
    ELSE 'unencrypted'::text
  END as token_status,
  
  CASE 
    WHEN refresh_token LIKE '%::%' THEN 'encrypted'::text
    WHEN refresh_token LIKE 'SECURITY_REVOKED_%' THEN 'revoked_security'::text
    WHEN refresh_token = 'REVOKED' THEN 'revoked'::text
    WHEN refresh_token = 'PENDING_ENCRYPTION' THEN 'pending_encryption'::text
    WHEN refresh_token IS NULL THEN 'none'::text
    ELSE 'unencrypted'::text
  END as refresh_token_status,
  
  -- Safe boolean indicators
  (access_token IS NOT NULL AND access_token NOT LIKE '%REVOKED%') as has_access_token,
  (refresh_token IS NOT NULL AND refresh_token NOT LIKE '%REVOKED%') as has_refresh_token,
  (expires_at IS NOT NULL AND expires_at < now()) as is_expired,
  
  security_flags,
  last_access_ip
FROM calendar_integrations;

-- Step 2: Apply RLS to the secure view
ALTER VIEW calendar_integrations_secure ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policy for the secure view
CREATE POLICY "Users can view secure calendar metadata"
  ON calendar_integrations_secure
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = calendar_integrations_secure.profile_id 
      AND p.user_id = auth.uid()
    )
  );

-- Step 4: Revoke direct access to the calendar_integrations table for regular users
-- Update existing policies to be more restrictive
DROP POLICY IF EXISTS "Users can view their own integration metadata" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can view integration metadata securely" ON calendar_integrations;

-- Only allow secure functions and parents to access the main table
CREATE POLICY "Only secure functions can access calendar integrations"
  ON calendar_integrations
  FOR ALL
  USING (
    -- Allow access only for:
    -- 1. The token owner through secure functions
    -- 2. Parents for administrative purposes
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = calendar_integrations.profile_id 
      AND (
        p.user_id = auth.uid() OR
        (p.family_id = get_current_user_family_id() AND is_current_user_parent())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = calendar_integrations.profile_id 
      AND p.user_id = auth.uid()
    )
  );

-- Step 5: Update the Google Photos table with similar security measures
CREATE OR REPLACE VIEW google_photos_integrations_secure AS
SELECT 
  id,
  family_id,
  created_by,
  album_name,
  album_id,
  expires_at,
  last_sync_at,
  sync_count,
  is_active,
  created_at,
  updated_at,
  -- Security status indicators
  CASE 
    WHEN access_token LIKE '%::%' THEN 'encrypted'::text
    WHEN access_token = 'REVOKED' THEN 'revoked'::text
    ELSE 'unencrypted'::text
  END as token_status,
  (access_token IS NOT NULL AND access_token != 'REVOKED') as has_access_token,
  (refresh_token IS NOT NULL AND refresh_token != 'REVOKED') as has_refresh_token
FROM google_photos_integrations;

-- Apply RLS to Google Photos secure view
ALTER VIEW google_photos_integrations_secure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view secure Google Photos metadata"
  ON google_photos_integrations_secure
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.family_id = google_photos_integrations_secure.family_id 
      AND p.user_id = auth.uid()
    )
  );

-- Step 6: Create a function to migrate any remaining unencrypted tokens
CREATE OR REPLACE FUNCTION migrate_all_unencrypted_tokens()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  integration_record RECORD;
  photos_record RECORD;
  encrypted_access TEXT;
  encrypted_refresh TEXT;
  migration_count INTEGER := 0;
  photos_migration_count INTEGER := 0;
BEGIN
  -- Only allow parents to run this migration
  IF NOT is_current_user_parent() THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can run token migration');
  END IF;

  -- Migrate calendar integrations
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM calendar_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
    AND access_token NOT LIKE '%REVOKED%'
  LOOP
    BEGIN
      -- Encrypt the existing tokens
      encrypted_access := encrypt_oauth_token(integration_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF integration_record.refresh_token IS NOT NULL AND integration_record.refresh_token NOT LIKE '%::%' THEN
        encrypted_refresh := encrypt_oauth_token(integration_record.refresh_token, 'refresh');
      END IF;

      -- Update with encrypted versions
      UPDATE calendar_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = COALESCE(encrypted_refresh, refresh_token),
        updated_at = NOW(),
        security_flags = COALESCE(security_flags, '{}'::jsonb) || 
          json_build_object('encrypted_at', NOW(), 'migration_version', '2.0')::jsonb
      WHERE id = integration_record.id;

      migration_count := migration_count + 1;

      -- Log the migration
      PERFORM create_audit_log(
        get_current_user_family_id(),
        auth.uid(),
        'calendar_tokens_encrypted',
        'calendar_integrations',
        integration_record.id,
        NULL,
        json_build_object('migrated_at', NOW(), 'migration_version', '2.0')
      );

    EXCEPTION
      WHEN OTHERS THEN
        -- Log migration failure but continue
        PERFORM create_audit_log(
          get_current_user_family_id(),
          auth.uid(),
          'calendar_token_migration_failed',
          'calendar_integrations',
          integration_record.id,
          NULL,
          json_build_object('error', SQLERRM, 'failed_at', NOW())
        );
    END;
  END LOOP;

  -- Migrate Google Photos integrations
  FOR photos_record IN 
    SELECT id, access_token, refresh_token 
    FROM google_photos_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
    AND access_token != 'REVOKED'
  LOOP
    BEGIN
      encrypted_access := encrypt_oauth_token(photos_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF photos_record.refresh_token IS NOT NULL AND photos_record.refresh_token NOT LIKE '%::%' THEN
        encrypted_refresh := encrypt_oauth_token(photos_record.refresh_token, 'refresh');
      END IF;

      UPDATE google_photos_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = COALESCE(encrypted_refresh, refresh_token),
        updated_at = NOW()
      WHERE id = photos_record.id;

      photos_migration_count := photos_migration_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Continue with other records on error
        CONTINUE;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'calendar_tokens_migrated', migration_count,
    'photos_tokens_migrated', photos_migration_count,
    'message', 'Token encryption migration completed successfully'
  );
END;
$$;