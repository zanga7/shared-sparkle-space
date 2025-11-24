-- Drop the problematic policy
DROP POLICY IF EXISTS "Family members can view internal and assigned events" ON events;

-- Create security definer function to check event visibility
CREATE OR REPLACE FUNCTION can_view_event(event_id uuid, event_source_integration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- User must be in the same family as the event
  SELECT EXISTS (
    SELECT 1 
    FROM events e
    JOIN profiles p ON p.family_id = e.family_id
    WHERE e.id = event_id
      AND p.user_id = auth.uid()
      AND (
        -- Internal events are visible to all family members
        e.source_integration_id IS NULL
        OR
        -- External events only visible to attendees
        EXISTS (
          SELECT 1 
          FROM event_attendees ea
          WHERE ea.event_id = e.id
            AND ea.profile_id = p.id
        )
      )
  );
$$;

-- Create new policy using the security definer function
CREATE POLICY "Family members can view events via function"
ON events
FOR SELECT
USING (can_view_event(id, source_integration_id));