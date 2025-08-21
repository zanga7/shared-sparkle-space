-- Add sort_order column to profiles table for member ordering
ALTER TABLE public.profiles ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing profiles to have sequential sort_order based on creation date
UPDATE public.profiles 
SET sort_order = row_number() OVER (PARTITION BY family_id ORDER BY created_at)
WHERE sort_order = 0;

-- Create index for better performance when ordering by sort_order
CREATE INDEX idx_profiles_family_sort ON public.profiles(family_id, sort_order);