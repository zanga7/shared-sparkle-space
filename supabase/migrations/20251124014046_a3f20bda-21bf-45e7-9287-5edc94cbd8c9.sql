-- Fix: Update search_path to include extensions schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value TEXT, token_type TEXT DEFAULT 'access')
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'extensions'  -- Include extensions schema
AS $$
DECLARE
  encryption_key TEXT;
  encrypted_token TEXT;
  salt TEXT;
BEGIN
  -- Generate unique salt for this token using pgcrypto
  salt := encode(gen_random_bytes(16), 'base64');
  
  -- Create encryption key from multiple sources
  encryption_key := encode(
    digest(
      coalesce(current_setting('app.settings.jwt_secret', true), 'default_key') || 
      salt || 
      token_type ||
      extract(epoch from now())::text,
      'sha256'
    ),
    'base64'
  );
  
  -- Encrypt the token value
  encrypted_token := encode(
    encrypt(
      token_value::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
  
  -- Return format: salt:encrypted_token
  RETURN salt || ':' || encrypted_token;
END;
$$;