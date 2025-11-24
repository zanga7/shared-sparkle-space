-- Enable pgcrypto extension for gen_random_bytes and pgp_sym_encrypt/decrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;