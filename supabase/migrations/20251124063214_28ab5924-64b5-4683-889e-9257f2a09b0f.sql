-- Add source tracking columns to events table for Google/Microsoft calendar sync
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS source_integration_id uuid REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS source_type text CHECK (source_type IN ('google', 'microsoft', 'internal')),
ADD COLUMN IF NOT EXISTS external_event_id text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_events_source_integration ON public.events(source_integration_id);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON public.events(external_event_id, source_integration_id);

-- Add sync_token column to calendar_integrations for incremental sync
ALTER TABLE public.calendar_integrations 
ADD COLUMN IF NOT EXISTS sync_token text,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone;

COMMENT ON COLUMN public.events.source_integration_id IS 'Links to the calendar integration this event was synced from';
COMMENT ON COLUMN public.events.source_type IS 'Source of the event: google, microsoft, or internal';
COMMENT ON COLUMN public.events.external_event_id IS 'Original event ID from external calendar provider';
COMMENT ON COLUMN public.events.last_synced_at IS 'Last time this event was synced from external calendar';