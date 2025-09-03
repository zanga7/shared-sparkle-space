-- Drop the duplicate function that's causing conflicts
DROP FUNCTION IF EXISTS public.set_child_pin(uuid, text);

-- Keep only the version with pin_type parameter
-- The function with pin_type_param already exists and is correct