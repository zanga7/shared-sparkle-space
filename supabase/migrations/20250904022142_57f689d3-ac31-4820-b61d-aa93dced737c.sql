-- Add encryption support for Google Photos tokens
-- Extend existing encryption functions to handle Google Photos tokens

CREATE OR REPLACE FUNCTION public.store_encrypted_google_photos_tokens(
  family_id_param uuid,
  access_token_param text,
  refresh_token_param text DEFAULT NULL,
  expires_at_param timestamp with time zone DEFAULT NULL,
  created_by_param uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
  integration_id UUID;
BEGIN
  -- Verify user has access to family
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND family_id = family_id_param AND role = 'parent'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized access to family');
  END IF;

  -- Encrypt tokens using existing encryption function
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'google_photos_access');
  
  IF refresh_token_param IS NOT NULL THEN
    encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'google_photos_refresh');
  END IF;

  -- Store encrypted tokens
  INSERT INTO public.google_photos_integrations (
    family_id,
    access_token,
    refresh_token,
    expires_at,
    created_by,
    is_active
  ) VALUES (
    family_id_param,
    encrypted_access_token,
    encrypted_refresh_token,
    expires_at_param,
    COALESCE(created_by_param, (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND family_id = family_id_param LIMIT 1)),
    true
  ) RETURNING id INTO integration_id;

  -- Log secure token storage
  PERFORM public.create_audit_log(
    family_id_param,
    auth.uid(),
    'google_photos_tokens_encrypted',
    'google_photos_integrations',
    integration_id,
    NULL,
    json_build_object('encrypted_at', NOW(), 'expires_at', expires_at_param)
  );

  RETURN json_build_object('success', true, 'integration_id', integration_id, 'message', 'Google Photos tokens encrypted and stored securely');
END;
$function$;

-- Function to get decrypted Google Photos tokens
CREATE OR REPLACE FUNCTION public.get_decrypted_google_photos_tokens(
  family_id_param uuid
) RETURNS TABLE(
  access_token text, 
  refresh_token text, 
  expires_at timestamp with time zone,
  is_expired boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Verify user has access to family
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND family_id = family_id_param
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to family Google Photos integration';
  END IF;

  -- Get integration
  SELECT gpi.access_token, gpi.refresh_token, gpi.expires_at, gpi.id
  INTO integration_record
  FROM public.google_photos_integrations gpi
  WHERE gpi.family_id = family_id_param AND gpi.is_active = true
  ORDER BY gpi.created_at DESC
  LIMIT 1;

  IF integration_record IS NULL THEN
    RAISE EXCEPTION 'Google Photos integration not found';
  END IF;

  -- Decrypt tokens
  decrypted_access := public.decrypt_oauth_token(
    integration_record.access_token, 
    'google_photos_access'
  );
  
  IF integration_record.refresh_token IS NOT NULL THEN
    decrypted_refresh := public.decrypt_oauth_token(
      integration_record.refresh_token, 
      'google_photos_refresh'
    );
  END IF;

  -- Log access for audit
  PERFORM public.create_audit_log(
    family_id_param,
    auth.uid(),
    'google_photos_tokens_accessed',
    'google_photos_integrations',
    integration_record.id,
    NULL,
    json_build_object('accessed_at', NOW())
  );

  -- Return decrypted tokens with expiration info
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;

-- Function to update Google Photos tokens securely
CREATE OR REPLACE FUNCTION public.update_google_photos_tokens(
  family_id_param uuid,
  access_token_param text,
  expires_at_param timestamp with time zone DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  encrypted_access_token TEXT;
BEGIN
  -- Verify user has access to family
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND family_id = family_id_param
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized access to family');
  END IF;

  -- Encrypt the new access token
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'google_photos_access');

  -- Update the integration
  UPDATE public.google_photos_integrations 
  SET 
    access_token = encrypted_access_token,
    expires_at = expires_at_param,
    updated_at = NOW()
  WHERE family_id = family_id_param AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Google Photos integration not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Google Photos tokens updated securely');
END;
$function$;