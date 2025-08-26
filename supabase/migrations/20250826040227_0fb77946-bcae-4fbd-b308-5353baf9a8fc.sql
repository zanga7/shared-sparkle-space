-- URGENT: Fix missing profile and session issues
-- User has auth account but no profile record, and corrupted session preventing logout

-- 1. First, let's check if we can create missing profiles for authenticated users
-- This handles the case where a user exists in auth.users but not in profiles

-- Create a function to safely create missing profiles
CREATE OR REPLACE FUNCTION public.create_missing_profile_for_user(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_email TEXT;
  user_metadata JSONB;
  family_name TEXT;
  display_name TEXT;
  new_family_id UUID;
  profile_exists BOOLEAN;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = user_id_param) INTO profile_exists;
  
  IF profile_exists THEN
    RETURN json_build_object('success', false, 'message', 'Profile already exists');
  END IF;

  -- Get user info from auth.users (this requires elevated permissions)
  -- For now, we'll create a basic profile with defaults
  
  -- Create a new family for this user
  INSERT INTO public.families (name) 
  VALUES ('New Family') 
  RETURNING id INTO new_family_id;
  
  -- Create the missing profile
  INSERT INTO public.profiles (
    user_id, 
    family_id, 
    display_name, 
    role
  ) VALUES (
    user_id_param,
    new_family_id,
    'User', -- Default display name
    'parent' -- Default to parent role
  );

  RETURN json_build_object('success', true, 'message', 'Profile created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_missing_profile_for_user TO authenticated;

-- 3. Create a function that authenticated users can call to fix their own missing profile
CREATE OR REPLACE FUNCTION public.fix_my_missing_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow authenticated users to call this
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Must be authenticated');
  END IF;

  -- Call the helper function for the current user
  RETURN public.create_missing_profile_for_user(auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_my_missing_profile TO authenticated;

-- 4. Also, let's make the RLS policies more forgiving for the case where someone has auth but no profile yet
-- Modify the policies to handle missing profiles gracefully

-- Drop the problematic family_profile_view policy and recreate it more safely
DROP POLICY IF EXISTS "family_profile_view" ON public.profiles;

CREATE POLICY "family_profile_view" 
ON public.profiles 
FOR SELECT
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 
    FROM public.profiles requester 
    WHERE requester.user_id = auth.uid() 
    AND requester.family_id = profiles.family_id
  )
  OR
  -- Allow viewing if this is the only profile query for the current user (handles missing profile case)
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- 5. Ensure the trigger for creating profiles on signup is working
-- Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
    family_name TEXT;
    new_family_id UUID;
    display_name TEXT;
BEGIN
    -- Extract info from user metadata with fallbacks
    family_name := COALESCE(NEW.raw_user_meta_data ->> 'family_name', 'New Family');
    display_name := COALESCE(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Create family first
    INSERT INTO public.families (name) 
    VALUES (family_name)
    RETURNING id INTO new_family_id;
    
    -- Create profile
    INSERT INTO public.profiles (user_id, family_id, display_name, role)
    VALUES (
        NEW.id, 
        new_family_id,
        display_name,
        'parent'::public.user_role
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        -- The user can fix their profile later using the fix function
        RETURN NEW;
END;
$$;

-- 6. Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Create a simple function to check profile status
CREATE OR REPLACE FUNCTION public.check_profile_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  profile_count INTEGER;
  user_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('authenticated', false);
  END IF;

  -- Check if profile exists
  SELECT COUNT(*) INTO profile_count 
  FROM public.profiles 
  WHERE user_id = auth.uid();

  RETURN json_build_object(
    'authenticated', true,
    'user_id', auth.uid(),
    'has_profile', profile_count > 0,
    'profile_count', profile_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_profile_status TO authenticated;