-- Drop the existing foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Make user_id nullable for child members
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Add a new constraint that allows null user_id for children but requires it for parents
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add a check constraint to ensure parents have user_id but children can have null
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_role_check 
  CHECK (
    (role = 'parent' AND user_id IS NOT NULL) OR 
    (role = 'child' AND user_id IS NULL)
  );