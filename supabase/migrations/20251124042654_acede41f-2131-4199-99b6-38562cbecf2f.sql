-- Comprehensive fix for any remaining search_path issues in SECURITY DEFINER functions
-- This migration ensures all critical functions have proper search_path protection

-- Update get_user_family_id if needed
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Update hash_pin if needed  
CREATE OR REPLACE FUNCTION public.hash_pin(pin_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(pin_text, gen_salt('bf', 10));
END;
$$;

-- Update verify_pin if needed
CREATE OR REPLACE FUNCTION public.verify_pin(pin_text TEXT, pin_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pin_hash = crypt(pin_text, pin_hash);
END;
$$;

-- Update is_super_admin if it exists
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  target_user_id := COALESCE(check_user_id, auth.uid());
  
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = target_user_id 
    AND role = 'super_admin'
  );
END;
$$;

-- Update is_current_user_parent if it exists
CREATE OR REPLACE FUNCTION public.is_current_user_parent()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'parent'
  );
$$;

-- Update get_current_user_family_id if it exists
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id 
  FROM public.profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;