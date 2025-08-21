-- Drop existing RLS policies on calendar_integrations
DROP POLICY IF EXISTS "Users can manage their own calendar integrations" ON public.calendar_integrations;

-- Create more restrictive RLS policies for calendar integrations
-- Only allow users to access their own calendar integration data
CREATE POLICY "Users can view their own calendar integrations only" 
ON public.calendar_integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own calendar integrations only" 
ON public.calendar_integrations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own calendar integrations only" 
ON public.calendar_integrations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own calendar integrations only" 
ON public.calendar_integrations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = calendar_integrations.profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create a security definer function to safely check calendar integration ownership
CREATE OR REPLACE FUNCTION public.is_calendar_integration_owner(integration_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.calendar_integrations ci
    JOIN public.profiles p ON p.id = ci.profile_id
    WHERE ci.id = integration_id 
    AND p.user_id = auth.uid()
  );
$$;

-- Add a function to securely get calendar integration without exposing tokens to logs
CREATE OR REPLACE FUNCTION public.get_calendar_integration_safe(integration_id UUID)
RETURNS TABLE(
  id UUID,
  profile_id UUID,
  integration_type TEXT,
  calendar_id TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    ci.id,
    ci.profile_id,
    ci.integration_type,
    ci.calendar_id,
    ci.is_active,
    ci.created_at,
    ci.updated_at,
    ci.expires_at
  FROM public.calendar_integrations ci
  JOIN public.profiles p ON p.id = ci.profile_id
  WHERE ci.id = integration_id 
  AND p.user_id = auth.uid();
$$;

-- Add comments to document security measures
COMMENT ON TABLE public.calendar_integrations IS 'Calendar integration data with OAuth tokens. Access strictly limited to token owners only.';
COMMENT ON COLUMN public.calendar_integrations.access_token IS 'OAuth access token - sensitive data, should only be accessible by token owner';
COMMENT ON COLUMN public.calendar_integrations.refresh_token IS 'OAuth refresh token - sensitive data, should only be accessible by token owner';