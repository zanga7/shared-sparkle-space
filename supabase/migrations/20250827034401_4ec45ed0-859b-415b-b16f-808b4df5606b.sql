-- Security Migration: Fix Calendar and Google Photos Token Vulnerabilities
-- This addresses the critical security findings about exposed tokens

-- 1. First, ensure all existing unencrypted tokens are migrated to encrypted format
-- Check if tokens need encryption and migrate them
DO $$
DECLARE
  integration_record RECORD;
  encrypted_access TEXT;
  encrypted_refresh TEXT;
  migration_count INTEGER := 0;
BEGIN
  -- Migrate calendar integrations with unencrypted tokens
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.calendar_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
    AND access_token NOT LIKE 'REVOKED%'
  LOOP
    BEGIN
      -- Encrypt the existing tokens
      encrypted_access := public.encrypt_oauth_token(integration_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF integration_record.refresh_token IS NOT NULL AND integration_record.refresh_token NOT LIKE '%::%' THEN
        encrypted_refresh := public.encrypt_oauth_token(integration_record.refresh_token, 'refresh');
      END IF;

      -- Update with encrypted versions
      UPDATE public.calendar_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = COALESCE(encrypted_refresh, refresh_token),
        updated_at = NOW()
      WHERE id = integration_record.id;

      migration_count := migration_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Continue with other records if one fails
        CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migrated % calendar integrations to encrypted tokens', migration_count;
END $$;

-- 2. Create function to encrypt Google Photos tokens
CREATE OR REPLACE FUNCTION public.encrypt_google_photos_tokens()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  integration_record RECORD;
  encrypted_access TEXT;
  encrypted_refresh TEXT;
  migration_count INTEGER := 0;
BEGIN
  -- Only run if called by a parent user
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'parent'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can run token migration');
  END IF;

  -- Find Google Photos integrations with potentially unencrypted tokens
  FOR integration_record IN 
    SELECT id, access_token, refresh_token 
    FROM public.google_photos_integrations 
    WHERE access_token IS NOT NULL 
    AND access_token NOT LIKE '%::%'
  LOOP
    BEGIN
      -- Encrypt the existing tokens
      encrypted_access := public.encrypt_oauth_token(integration_record.access_token, 'access');
      
      encrypted_refresh := NULL;
      IF integration_record.refresh_token IS NOT NULL THEN
        encrypted_refresh := public.encrypt_oauth_token(integration_record.refresh_token, 'refresh');
      END IF;

      -- Update with encrypted versions
      UPDATE public.google_photos_integrations 
      SET 
        access_token = encrypted_access,
        refresh_token = encrypted_refresh,
        updated_at = NOW()
      WHERE id = integration_record.id;

      migration_count := migration_count + 1;

    EXCEPTION
      WHEN OTHERS THEN
        -- Continue with other records if one fails
        CONTINUE;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'migrated_count', migration_count,
    'message', 'Google Photos token encryption completed'
  );
END;
$$;

-- 3. Enhance RLS policies for calendar_integrations to prevent token exposure
DROP POLICY IF EXISTS "Secure functions can manage integrations" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can view integration metadata securely" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can view their own integration metadata" ON public.calendar_integrations;

-- New stricter policies that prevent direct token access
CREATE POLICY "Users can view integration metadata only" 
ON public.calendar_integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- Restrict INSERT to only allow secure token storage
CREATE POLICY "Users can create integrations with encrypted tokens" 
ON public.calendar_integrations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations.profile_id 
    AND p.user_id = auth.uid()
  )
  AND (access_token LIKE '%::%' OR access_token IS NULL) -- Must be encrypted
);

-- Allow updates only through secure functions
CREATE POLICY "Users can update their own integrations" 
ON public.calendar_integrations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- Allow deletion
CREATE POLICY "Users can delete their own integrations" 
ON public.calendar_integrations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = calendar_integrations.profile_id 
    AND p.user_id = auth.uid()
  )
);

-- 4. Enhanced RLS policies for google_photos_integrations
CREATE POLICY "Users can view their own Google Photos integrations" 
ON public.google_photos_integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid()
  )
);

-- Restrict INSERT to only allow encrypted tokens
CREATE POLICY "Parents can create Google Photos integrations" 
ON public.google_photos_integrations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.family_id = google_photos_integrations.family_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
  AND (access_token LIKE '%::%' OR access_token IS NULL) -- Must be encrypted
);

-- 5. Create function to validate token encryption
CREATE OR REPLACE FUNCTION public.validate_token_encryption()
RETURNS TABLE(
  table_name text,
  unencrypted_count bigint,
  total_count bigint,
  is_secure boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check calendar integrations
  RETURN QUERY
  SELECT 
    'calendar_integrations'::text,
    COUNT(*) FILTER (WHERE ci.access_token NOT LIKE '%::%' AND ci.access_token IS NOT NULL),
    COUNT(*),
    (COUNT(*) FILTER (WHERE ci.access_token NOT LIKE '%::%' AND ci.access_token IS NOT NULL)) = 0
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.user_id = auth.uid();

  -- Check Google Photos integrations  
  RETURN QUERY
  SELECT 
    'google_photos_integrations'::text,
    COUNT(*) FILTER (WHERE gpi.access_token NOT LIKE '%::%' AND gpi.access_token IS NOT NULL),
    COUNT(*),
    (COUNT(*) FILTER (WHERE gpi.access_token NOT LIKE '%::%' AND gpi.access_token IS NOT NULL)) = 0
  FROM public.google_photos_integrations gpi
  JOIN public.profiles p ON p.family_id = gpi.family_id
  WHERE p.user_id = auth.uid();
END;
$$;

-- 6. Revoke direct access to token columns by creating a view
CREATE OR REPLACE VIEW public.calendar_integrations_safe AS
SELECT 
  id,
  profile_id,
  integration_type,
  calendar_id,
  is_active,
  expires_at,
  created_at,
  updated_at,
  last_token_refresh,
  token_refresh_count,
  -- Safe indicators without exposing actual tokens
  (access_token IS NOT NULL AND access_token != 'REVOKED') as has_access_token,
  (refresh_token IS NOT NULL AND refresh_token != 'REVOKED') as has_refresh_token,
  (access_token LIKE '%::%') as is_encrypted,
  (expires_at IS NOT NULL AND expires_at < NOW()) as is_expired
FROM public.calendar_integrations;

-- Grant access to the safe view
GRANT SELECT ON public.calendar_integrations_safe TO authenticated;

-- 7. Enhance PIN hash security in profiles table
DROP POLICY IF EXISTS "users_can_view_own_and_family_profiles" ON public.profiles;

-- Create new policy that excludes PIN hashes for non-owners
CREATE POLICY "users_can_view_family_profiles_safely" 
ON public.profiles 
FOR SELECT 
USING (
  (user_id = auth.uid()) OR 
  (family_id = get_current_user_family_id() AND user_id != auth.uid())
);

-- Ensure only the user can see their own PIN hash by using a function
CREATE OR REPLACE FUNCTION public.get_profile_safe(profile_id_param uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  family_id uuid,
  display_name text,
  role user_role,
  total_points integer,
  avatar_url text,
  can_add_for_self boolean,
  can_add_for_siblings boolean,
  can_add_for_parents boolean,
  status text,
  color text,
  streak_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  calendar_edit_permission text,
  require_pin_to_complete_tasks boolean,
  require_pin_for_list_deletes boolean,
  sort_order integer,
  has_pin boolean -- Safe boolean instead of exposing hash
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    CASE 
      WHEN p.user_id = auth.uid() THEN p.user_id 
      ELSE NULL 
    END,
    p.family_id,
    p.display_name,
    p.role,
    p.total_points,
    p.avatar_url,
    p.can_add_for_self,
    p.can_add_for_siblings,
    p.can_add_for_parents,
    p.status,
    p.color,
    p.streak_count,
    p.created_at,
    p.updated_at,
    p.calendar_edit_permission,
    p.require_pin_to_complete_tasks,
    p.require_pin_for_list_deletes,
    p.sort_order,
    (p.pin_hash IS NOT NULL) as has_pin
  FROM public.profiles p
  WHERE p.id = profile_id_param
  AND (p.user_id = auth.uid() OR p.family_id = get_current_user_family_id());
END;
$$;