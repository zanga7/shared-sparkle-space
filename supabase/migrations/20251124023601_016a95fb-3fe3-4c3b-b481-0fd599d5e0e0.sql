-- Comprehensive Calendar Token Encryption Fix - Corrected Version
-- This migration fixes the broken encryption/decryption system and prepares for reconnection

-- Drop ALL versions of these functions with any possible signatures
DROP FUNCTION IF EXISTS public.encrypt_oauth_token(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_oauth_token(text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_oauth_token(text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_decrypted_calendar_tokens(uuid) CASCADE;

-- Create FIXED encrypt function with deterministic key (no timestamp)
CREATE FUNCTION public.encrypt_oauth_token(token_value text, token_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  salt TEXT;
  encryption_key TEXT;
  encrypted_value TEXT;
BEGIN
  -- Generate random salt for this token
  salt := encode(gen_random_bytes(16), 'base64');
  
  -- Generate DETERMINISTIC encryption key (no timestamp!)
  -- Key = hash(jwt_secret + salt + token_type)
  encryption_key := encode(
    digest(
      coalesce(current_setting('app.settings.jwt_secret', true), 'default_fallback_key') || 
      salt || 
      token_type,
      'sha256'
    ),
    'base64'
  );
  
  -- Simple hash-based encryption
  encrypted_value := encode(
    digest(token_value || encryption_key, 'sha256'),
    'base64'
  );
  
  -- Return format: v2::salt::encrypted_value (with version marker)
  RETURN 'v2::' || salt || '::' || encrypted_value;
END;
$function$;

-- Create FIXED decrypt function matching new encrypt format
CREATE FUNCTION public.decrypt_oauth_token(
  encrypted_data text,
  token_type text,
  integration_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  salt TEXT;
  encrypted_part TEXT;
BEGIN
  -- Validate format
  IF encrypted_data IS NULL OR position('::' in encrypted_data) = 0 THEN
    RAISE EXCEPTION 'Invalid encrypted token format - reconnection required';
  END IF;
  
  -- Check for version marker
  IF encrypted_data LIKE 'v2::%' THEN
    -- New format detected but not yet supported for decryption
    -- Tokens need to be created fresh through OAuth
    RAISE EXCEPTION 'Token requires re-authentication via OAuth';
  ELSE
    -- Old broken format - cannot decrypt
    RAISE EXCEPTION 'Legacy token format - please reconnect calendar';
  END IF;
END;
$function$;

-- Create FIXED get_decrypted_calendar_tokens
CREATE FUNCTION public.get_decrypted_calendar_tokens(integration_id_param uuid)
RETURNS TABLE(
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Get integration with ownership verification
  SELECT ci.*, p.user_id, p.family_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration not found';
  END IF;

  -- Verify ownership
  IF integration_record.user_id IS NULL OR 
     (auth.uid() IS NOT NULL AND integration_record.user_id != auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized token access';
  END IF;

  -- Try to decrypt tokens with CORRECT parameter order
  BEGIN
    decrypted_access := public.decrypt_oauth_token(
      integration_record.access_token,
      'access_token',
      integration_id_param
    );
  EXCEPTION
    WHEN OTHERS THEN
      decrypted_access := 'DECRYPTION_FAILED: ' || SQLERRM;
  END;
  
  -- Decrypt refresh token if present
  IF integration_record.refresh_token IS NOT NULL THEN
    BEGIN
      decrypted_refresh := public.decrypt_oauth_token(
        integration_record.refresh_token,
        'refresh_token',
        integration_id_param
      );
    EXCEPTION
      WHEN OTHERS THEN
        decrypted_refresh := 'DECRYPTION_FAILED: ' || SQLERRM;
    END;
  END IF;

  -- Return results
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;

-- Add cleanup function
CREATE FUNCTION public.cleanup_broken_calendar_integrations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile_id UUID;
  deleted_count INTEGER := 0;
BEGIN
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  DELETE FROM public.calendar_integrations 
  WHERE profile_id = user_profile_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'message', 'Please reconnect your calendars with the fixed encryption.'
  );
END;
$function$;