-- Remove the restrictive color check constraint from profiles table
-- This allows dynamic colors from the color_palettes table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_color_check;