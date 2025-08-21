-- CRITICAL SECURITY FIX: Encrypt calendar OAuth tokens at rest
-- Phase 1: Create secure token encryption infrastructure

-- Enhanced token encryption function using multiple layers
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value TEXT, token_type TEXT DEFAULT 'access')
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
  encrypted_token TEXT;
  salt TEXT;
BEGIN
  -- Generate unique salt for this token
  salt := encode(gen_random_bytes(16), 'base64');
  
  -- Create encryption key from multiple sources for enhanced security
  encryption_key := encode(
    digest(
      current_setting('app.settings.jwt_secret', true) || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Encrypt using pgp_sym_encrypt with the derived key
  encrypted_token := encode(
    pgp_sym_encrypt(
      token_value,
      encryption_key,
      'cipher-algo=aes256, compress-algo=2'
    ),
    'base64'
  );
  
  -- Return salt + encrypted token for later decryption
  RETURN salt || '::' || encrypted_token;
EXCEPTION
  WHEN OTHERS THEN
    -- Log security event without exposing token
    PERFORM public.create_audit_log(
      NULL,
      auth.uid(),
      'token_encryption_failed',
      'calendar_integrations',
      NULL,
      NULL,
      json_build_object('error', 'Token encryption failed', 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token encryption failed';
END;
$$;

-- Enhanced token decryption function with security controls
CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_data TEXT, token_type TEXT DEFAULT 'access', requesting_integration_id UUID DEFAULT NULL)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  salt TEXT;
  encrypted_token TEXT;
  encryption_key TEXT;
  decrypted_token TEXT;
  parts TEXT[];
  integration_owner UUID;
BEGIN
  -- Verify access permissions if integration_id provided
  IF requesting_integration_id IS NOT NULL THEN
    SELECT p.user_id INTO integration_owner
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = requesting_integration_id;
    
    -- Only allow token owner or system functions to decrypt
    IF integration_owner IS NULL OR (auth.uid() IS NOT NULL AND integration_owner != auth.uid()) THEN
      -- Log unauthorized access attempt
      PERFORM public.create_audit_log(
        NULL,
        auth.uid(),
        'unauthorized_token_access',
        'calendar_integrations',
        requesting_integration_id,
        NULL,
        json_build_object('attempted_by', auth.uid(), 'token_type', token_type)
      );
      RAISE EXCEPTION 'Unauthorized token access';
    END IF;
  END IF;

  -- Split salt and encrypted data
  parts := string_to_array(encrypted_data, '::');
  IF array_length(parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid token format';
  END IF;
  
  salt := parts[1];
  encrypted_token := parts[2];
  
  -- Recreate encryption key
  encryption_key := encode(
    digest(
      current_setting('app.settings.jwt_secret', true) || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Decrypt token
  decrypted_token := pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
  
  -- Log successful decryption for audit
  PERFORM public.create_audit_log(
    NULL,
    auth.uid(),
    'token_decryption_success',
    'calendar_integrations',
    requesting_integration_id,
    NULL,
    json_build_object('token_type', token_type, 'timestamp', now())
  );
  
  RETURN decrypted_token;
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    PERFORM public.create_audit_log(
      NULL,
      auth.uid(),
      'token_decryption_failed',
      'calendar_integrations',
      requesting_integration_id,
      NULL,
      json_build_object('error', SQLERRM, 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token decryption failed';
END;
$$;

-- Secure token storage function
CREATE OR REPLACE FUNCTION public.store_encrypted_calendar_tokens(
  integration_id_param UUID,
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
  encrypted_access_token TEXT;
  encrypted_refresh_token TEXT;
  integration_owner UUID;
BEGIN
  -- Verify integration ownership
  SELECT p.user_id INTO integration_owner
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;
  
  IF integration_owner IS NULL OR integration_owner != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized access to integration');
  END IF;

  -- Encrypt tokens
  encrypted_access_token := public.encrypt_oauth_token(access_token_param, 'access');
  
  IF refresh_token_param IS NOT NULL THEN
    encrypted_refresh_token := public.encrypt_oauth_token(refresh_token_param, 'refresh');
  END IF;

  -- Store encrypted tokens
  UPDATE public.calendar_integrations 
  SET 
    access_token = encrypted_access_token,
    refresh_token = encrypted_refresh_token,
    expires_at = expires_at_param,
    updated_at = NOW(),
    last_token_refresh = NOW(),
    token_refresh_count = COALESCE(token_refresh_count, 0) + 1
  WHERE id = integration_id_param;

  -- Log secure token storage
  PERFORM public.create_audit_log(
    (SELECT p.family_id FROM public.profiles p 
     JOIN public.calendar_integrations ci ON ci.profile_id = p.id 
     WHERE ci.id = integration_id_param),
    auth.uid(),
    'calendar_tokens_encrypted',
    'calendar_integrations',
    integration_id_param,
    NULL,
    json_build_object('encrypted_at', NOW(), 'expires_at', expires_at_param)
  );

  RETURN json_build_object('success', true, 'message', 'Tokens encrypted and stored securely');
END;
$$;

-- Secure token retrieval function for API calls
CREATE OR REPLACE FUNCTION public.get_decrypted_calendar_tokens(integration_id_param UUID)
RETURNS TABLE(
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_expired BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Get integration with ownership verification
  SELECT ci.*, p.user_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  -- Verify ownership (only token owner or system can access)
  IF integration_record.user_id IS NULL OR 
     (auth.uid() IS NOT NULL AND integration_record.user_id != auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized token access';
  END IF;

  -- Decrypt tokens
  decrypted_access := public.decrypt_oauth_token(
    integration_record.access_token, 
    'access', 
    integration_id_param
  );
  
  IF integration_record.refresh_token IS NOT NULL THEN
    decrypted_refresh := public.decrypt_oauth_token(
      integration_record.refresh_token, 
      'refresh', 
      integration_id_param
    );
  END IF;

  -- Return decrypted tokens with expiration info
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$$;