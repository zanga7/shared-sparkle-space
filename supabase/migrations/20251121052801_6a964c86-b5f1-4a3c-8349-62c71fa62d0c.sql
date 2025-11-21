-- Fix encrypt_oauth_token function to use correct parameter types for create_audit_log
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
    -- Log security event without exposing token - use jsonb_build_object instead of json_build_object
    PERFORM public.create_audit_log(
      NULL,
      auth.uid(),
      'token_encryption_failed',
      'calendar_integrations',
      NULL,
      NULL,
      jsonb_build_object('error', 'Token encryption failed', 'token_type', token_type)
    );
    RAISE EXCEPTION 'Token encryption failed';
END;
$function$;