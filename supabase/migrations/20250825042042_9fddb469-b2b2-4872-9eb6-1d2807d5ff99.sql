-- Add category_id column to lists table
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id);

-- Update RLS policy for categories to allow proper creation by authenticated users
DROP POLICY IF EXISTS "Parents can manage categories" ON public.categories;

CREATE POLICY "Parents can manage categories" 
ON public.categories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = categories.family_id 
    AND profiles.user_id = auth.uid() 
    AND profiles.role = 'parent'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = categories.family_id 
    AND profiles.user_id = auth.uid() 
    AND profiles.role = 'parent'
  )
);