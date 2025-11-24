-- Fix delete_calendar_integration_secure to use correct logging function
-- Removes call to non-existent log_calendar_token_access_enhanced function

CREATE OR REPLACE FUNCTION public.delete_calendar_integration_secure(
  integration_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id UUID;
  integration_deleted boolean;
  user_family_id UUID;
BEGIN
  -- Verify ownership
  SELECT p.id, p.family_id INTO user_profile_id, user_family_id
  FROM public.profiles p
  JOIN public.calendar_integrations ci ON ci.profile_id = p.id
  WHERE p.user_id = auth.uid() 
  AND ci.id = integration_id_param;
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Integration not found or access denied');
  END IF;

  -- Security wipe: overwrite sensitive data before deletion using extensions schema
  UPDATE public.calendar_integrations 
  SET 
    access_token = 'SECURELY_DELETED_' || encode(extensions.gen_random_bytes(32), 'hex'),
    refresh_token = CASE 
      WHEN refresh_token IS NOT NULL THEN 'SECURELY_DELETED_' || encode(extensions.gen_random_bytes(32), 'hex')
      ELSE NULL 
    END,
    is_active = false,
    security_flags = jsonb_build_object(
      'securely_deleted', true,
      'deleted_at', now(),
      'deleted_by', auth.uid()
    )
  WHERE id = integration_id_param;

  -- Now delete the record
  DELETE FROM public.calendar_integrations 
  WHERE id = integration_id_param;

  GET DIAGNOSTICS integration_deleted = ROW_COUNT;

  -- Log secure deletion using the correct function
  IF integration_deleted THEN
    PERFORM public.log_sensitive_access(
      'calendar_integrations',
      integration_id_param,
      'integration_securely_deleted',
      true,
      json_build_object('deleted_by', auth.uid())
    );
  END IF;

  RETURN json_build_object(
    'success', integration_deleted,
    'message', CASE WHEN integration_deleted THEN 'Integration securely deleted' ELSE 'Integration not found' END
  );
END;
$$;