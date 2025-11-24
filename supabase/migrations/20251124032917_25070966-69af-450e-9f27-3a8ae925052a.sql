-- Enable pgcrypto extension for secure random byte generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the function now works by testing it
DO $$
DECLARE
  test_result TEXT;
BEGIN
  test_result := encode(gen_random_bytes(16), 'base64');
  RAISE NOTICE 'pgcrypto extension enabled successfully. Test result: %', test_result;
END $$;