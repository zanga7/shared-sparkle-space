-- Drop existing view policies for events
DROP POLICY IF EXISTS "Family members can view events" ON events;

-- Create new policy that shows:
-- 1. Internal events (no source_integration_id) to all family members
-- 2. External synced events only to their attendees
CREATE POLICY "Family members can view internal and assigned events"
ON events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.family_id = events.family_id
    AND profiles.user_id = auth.uid()
  )
  AND (
    -- Show internal events to everyone in family
    events.source_integration_id IS NULL
    OR
    -- Show external synced events only to attendees
    EXISTS (
      SELECT 1 FROM event_attendees
      WHERE event_attendees.event_id = events.id
      AND event_attendees.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  )
);