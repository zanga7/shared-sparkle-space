-- Reset admin PIN to 1111
-- This will update all parent profiles to have PIN 1111

UPDATE profiles 
SET 
  pin_hash = crypt('1111', gen_salt('bf', 6)),
  failed_pin_attempts = 0,
  pin_locked_until = NULL,
  updated_at = now()
WHERE role = 'parent';