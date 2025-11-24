-- Fix calendar_token_audit constraint to allow new action types
ALTER TABLE public.calendar_token_audit 
DROP CONSTRAINT IF EXISTS calendar_token_audit_action_check;

-- Add updated constraint with all action types
ALTER TABLE public.calendar_token_audit 
ADD CONSTRAINT calendar_token_audit_action_check 
CHECK (action IN (
  'access', 
  'refresh', 
  'decrypt_access',
  'decrypt_refresh',
  'decrypt_access_failed',
  'decrypt_refresh_failed',
  'token_refresh',
  'token_revoked'
));