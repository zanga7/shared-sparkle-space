-- Backfill event_attendees for existing external calendar events
-- Add the integration owner as attendee for all synced events that don't have attendees

INSERT INTO event_attendees (event_id, profile_id, added_by)
SELECT 
  e.id,
  ci.profile_id,
  ci.profile_id
FROM events e
JOIN calendar_integrations ci ON ci.id = e.source_integration_id
WHERE e.source_integration_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM event_attendees ea 
    WHERE ea.event_id = e.id 
    AND ea.profile_id = ci.profile_id
  )
ON CONFLICT (event_id, profile_id) DO NOTHING;