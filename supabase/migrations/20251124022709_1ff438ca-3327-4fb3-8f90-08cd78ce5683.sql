-- Fix get_decrypted_calendar_tokens to actually decrypt the tokens
CREATE OR REPLACE FUNCTION public.get_decrypted_calendar_tokens(integration_id_param uuid)
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone, is_expired boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  integration_record RECORD;
  decrypted_access TEXT;
  decrypted_refresh TEXT;
BEGIN
  -- Get integration with ownership verification
  SELECT ci.*, p.user_id, p.family_id
  INTO integration_record
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id_param;

  -- Verify ownership (only token owner or system can access)
  IF integration_record.user_id IS NULL OR 
     (auth.uid() IS NOT NULL AND integration_record.user_id != auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized token access';
  END IF;

  -- Decrypt the access token using the decrypt function
  decrypted_access := public.decrypt_oauth_token(
    integration_record.access_token,
    integration_id_param,
    'access_token'
  );
  
  -- Decrypt refresh token if present
  IF integration_record.refresh_token IS NOT NULL THEN
    decrypted_refresh := public.decrypt_oauth_token(
      integration_record.refresh_token,
      integration_id_param,
      'refresh_token'
    );
  END IF;

  -- Log access with proper jsonb casting
  PERFORM public.create_audit_log(
    integration_record.family_id,
    auth.uid(),
    'calendar_token_access',
    'calendar_integrations',
    integration_id_param,
    NULL::jsonb,
    jsonb_build_object(
      'timestamp', NOW(),
      'ip_address', inet_client_addr()::text
    )
  );

  -- Return decrypted tokens with expiration info
  RETURN QUERY SELECT 
    decrypted_access,
    decrypted_refresh,
    integration_record.expires_at,
    (integration_record.expires_at IS NOT NULL AND integration_record.expires_at < NOW());
END;
$function$;