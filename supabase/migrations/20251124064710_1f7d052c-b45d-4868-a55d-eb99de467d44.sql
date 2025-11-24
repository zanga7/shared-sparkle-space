-- Add unique constraint for external events to enable proper upsert
ALTER TABLE public.events 
ADD CONSTRAINT events_external_unique 
UNIQUE (external_event_id, source_integration_id);

-- Add index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_events_source_integration 
ON public.events(source_integration_id) 
WHERE source_integration_id IS NOT NULL;