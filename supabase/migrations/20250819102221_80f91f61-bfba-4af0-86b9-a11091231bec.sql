-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    family_name TEXT;
    new_family_id UUID;
BEGIN
    -- Extract family name from metadata or use default
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    
    -- Create family first
    INSERT INTO public.families (name) 
    VALUES (family_name)
    RETURNING id INTO new_family_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        new_family_id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        'parent'::public.user_role
    );
    
    RETURN NEW;
END;
$$;