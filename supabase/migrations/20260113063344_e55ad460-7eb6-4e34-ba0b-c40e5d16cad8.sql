-- Fix overly permissive RLS policy on rotation_events
-- The current policy allows ANY insert with true, which is a security risk
-- Replace with a policy that requires authenticated system/parent access

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert rotation events" ON rotation_events;

-- Create a new policy that requires parent role for inserting rotation events
-- This ensures only authenticated parents can trigger rotation event creation
CREATE POLICY "Parents can insert rotation events" 
ON rotation_events 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.family_id = rotation_events.family_id
    AND p.role = 'parent'
  )
);