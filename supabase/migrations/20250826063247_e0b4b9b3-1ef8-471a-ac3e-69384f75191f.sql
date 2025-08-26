-- Fix storage policies for screensaver images
-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Family members can view screensaver images" ON storage.objects;
DROP POLICY IF EXISTS "Parents can upload screensaver images" ON storage.objects;
DROP POLICY IF EXISTS "Parents can update screensaver images" ON storage.objects;  
DROP POLICY IF EXISTS "Parents can delete screensaver images" ON storage.objects;

-- Create correct policies
CREATE POLICY "Family members can view screensaver images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'screensaver-images' AND 
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN screensaver_images si ON si.family_id = p.family_id
    WHERE si.file_path = storage.objects.name 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can upload screensaver images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'screensaver-images' AND 
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);

CREATE POLICY "Parents can update screensaver images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'screensaver-images' AND 
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN screensaver_images si ON si.family_id = p.family_id
    WHERE si.file_path = storage.objects.name 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);

CREATE POLICY "Parents can delete screensaver images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'screensaver-images' AND 
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN screensaver_images si ON si.family_id = p.family_id
    WHERE si.file_path = storage.objects.name 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);