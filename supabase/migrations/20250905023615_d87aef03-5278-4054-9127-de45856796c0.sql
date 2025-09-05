-- Add migration tracking column to events table
ALTER TABLE public.events 
ADD COLUMN migrated_to_series BOOLEAN DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.events.migrated_to_series IS 
'Tracks whether this legacy recurring event has been migrated to the new series system';

-- Create index for migration queries (without CONCURRENTLY)
CREATE INDEX idx_events_migration_status 
ON public.events (family_id, migrated_to_series) 
WHERE migrated_to_series IS NULL;