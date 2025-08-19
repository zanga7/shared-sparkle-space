-- Fix the remaining search path issue for get_user_family_id
DROP FUNCTION IF EXISTS public.get_user_family_id();

CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS UUID 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT family_id FROM public.profiles WHERE user_id = auth.uid();
$$;