-- Add sort_order column to profiles table for member ordering
ALTER TABLE public.profiles ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing profiles to have sequential sort_order based on creation date
WITH ordered_profiles AS (
  SELECT id, row_number() OVER (PARTITION BY family_id ORDER BY created_at) as new_sort_order
  FROM public.profiles
  WHERE sort_order = 0
)
UPDATE public.profiles 
SET sort_order = ordered_profiles.new_sort_order
FROM ordered_profiles
WHERE public.profiles.id = ordered_profiles.id;

-- Create index for better performance when ordering by sort_order
CREATE INDEX idx_profiles_family_sort ON public.profiles(family_id, sort_order);