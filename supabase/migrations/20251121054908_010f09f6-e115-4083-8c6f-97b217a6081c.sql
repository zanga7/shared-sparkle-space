-- Fix encrypt_oauth_token to properly handle audit logging with family_id
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value text, token_type text DEFAULT 'access'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
  encrypted_token TEXT;
  salt TEXT;
  user_family_id UUID;
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
    -- Get user's family_id for audit log
    SELECT family_id INTO user_family_id
    FROM public.profiles 
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    -- Only log if we can determine family_id
    IF user_family_id IS NOT NULL THEN
      PERFORM public.create_audit_log(
        user_family_id,
        auth.uid(),
        'token_encryption_failed',
        'calendar_integrations',
        NULL,
        NULL,
        jsonb_build_object('error', SQLERRM, 'token_type', token_type)
      );
    END IF;
    
    RAISE EXCEPTION 'Token encryption failed: %', SQLERRM;
END;
$function$;