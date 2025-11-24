-- Enable pgcrypto extension for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the encrypt_oauth_token function works with the extension
-- The function should now have access to gen_random_bytes()