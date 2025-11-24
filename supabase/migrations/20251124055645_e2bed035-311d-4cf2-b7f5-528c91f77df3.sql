-- Fix encrypt_oauth_token to use fully qualified extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value text, token_type text DEFAULT 'access'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key TEXT;
  salt TEXT;
  encrypted_data TEXT;
BEGIN
  IF token_value IS NULL OR token_value = '' THEN
    RETURN NULL;
  END IF;

  -- Get encryption key from secrets
  SELECT value INTO encryption_key
  FROM public.oauth_secrets
  WHERE key = 'CALENDAR_TOKEN_ENCRYPTION_KEY';

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;

  -- Generate random salt using fully qualified function name
  salt := encode(extensions.gen_random_bytes(16), 'hex');

  -- Encrypt using PGP with key + token_type + salt
  encrypted_data := encode(
    extensions.pgp_sym_encrypt(
      token_value::bytea,
      encryption_key || '_' || token_type || '_' || salt
    ),
    'base64'
  );

  -- Return format: encrypted_data::salt
  RETURN encrypted_data || '::' || salt;
END;
$function$;