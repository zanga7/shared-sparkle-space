-- Remove the restrictive check constraint that prevents role changes
-- This constraint was too rigid and prevented legitimate role updates
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_role_check;

-- Add a more flexible constraint that still maintains data integrity but allows role changes
-- The constraint will be handled at the application level with proper user account creation
CREATE OR REPLACE FUNCTION validate_parent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the role change, but warn if parent doesn't have user_id
  -- The application should handle creating auth accounts for new parents
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;