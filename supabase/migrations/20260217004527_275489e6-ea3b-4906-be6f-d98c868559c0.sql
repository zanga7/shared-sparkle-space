
-- Table to track webhook watch channels/subscriptions for each calendar integration
CREATE TABLE public.calendar_webhook_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid NOT NULL REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'google' or 'microsoft'
  channel_id text NOT NULL, -- Google channel ID or Microsoft subscription ID
  resource_id text, -- Google resource ID
  expiration timestamptz NOT NULL, -- when the watch/subscription expires
  webhook_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id)
);

ALTER TABLE public.calendar_webhook_channels ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) manage these, no direct user access needed
CREATE POLICY "No direct user access to webhook channels"
  ON public.calendar_webhook_channels
  FOR SELECT
  USING (false);

CREATE POLICY "Super admins can view webhook channels"
  ON public.calendar_webhook_channels
  FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can delete webhook channels"
  ON public.calendar_webhook_channels
  FOR DELETE
  USING (is_super_admin());
