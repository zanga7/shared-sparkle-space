-- Drop and recreate get_token_encryption_status to detect broken v1 encrypted tokens
DROP FUNCTION IF EXISTS public.get_token_encryption_status();

CREATE OR REPLACE FUNCTION public.get_token_encryption_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_integrations INTEGER;
  v2_encrypted_integrations INTEGER;
  broken_v1_integrations INTEGER;
  user_family_id UUID;
BEGIN
  -- Get current user's family
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_family_id IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;

  -- Count total integrations in family
  SELECT COUNT(*) INTO total_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id;

  -- Count v2 encrypted integrations (those starting with 'v2::')
  SELECT COUNT(*) INTO v2_encrypted_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  AND ci.access_token LIKE 'v2::%';

  -- Count broken v1 integrations (have '::' but don't start with 'v2::')
  SELECT COUNT(*) INTO broken_v1_integrations
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE p.family_id = user_family_id
  AND ci.access_token LIKE '%::%'
  AND ci.access_token NOT LIKE 'v2::%';

  RETURN json_build_object(
    'total_integrations', total_integrations,
    'encrypted_integrations', v2_encrypted_integrations,
    'broken_integrations', broken_v1_integrations,
    'unencrypted_integrations', total_integrations - v2_encrypted_integrations - broken_v1_integrations,
    'encryption_complete', (total_integrations = v2_encrypted_integrations),
    'has_broken_tokens', (broken_v1_integrations > 0)
  );
END;
$function$;