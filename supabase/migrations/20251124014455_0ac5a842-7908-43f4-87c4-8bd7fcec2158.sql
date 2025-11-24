-- Fix 1: Update calendar_integrations constraint to accept 'microsoft' instead of just 'outlook'
ALTER TABLE calendar_integrations 
DROP CONSTRAINT IF EXISTS calendar_integrations_integration_type_check;

ALTER TABLE calendar_integrations 
ADD CONSTRAINT calendar_integrations_integration_type_check 
CHECK (integration_type = ANY (ARRAY['google'::text, 'microsoft'::text, 'outlook'::text]));

-- Fix 2: Recreate log_sensitive_access to handle both json and jsonb
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_entity_type text, 
  p_entity_id uuid, 
  p_action text, 
  p_success boolean DEFAULT true, 
  p_details json DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get current user's family ID
  SELECT family_id INTO user_family_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Create detailed audit log (convert json to jsonb if needed)
  PERFORM public.create_audit_log(
    user_family_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    NULL,
    jsonb_build_object(
      'success', p_success,
      'timestamp', NOW(),
      'ip_address', inet_client_addr()::text,
      'details', CASE 
        WHEN p_details IS NOT NULL THEN p_details::jsonb 
        ELSE NULL 
      END
    )
  );
END;
$$;