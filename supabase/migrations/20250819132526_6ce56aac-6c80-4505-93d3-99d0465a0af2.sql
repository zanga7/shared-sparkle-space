-- Add INSERT policy for parents to create family member profiles
CREATE POLICY "Parents can create family member profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.family_id = profiles.family_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);