-- Allow all authenticated users to view avatar icons and color palettes
-- Super admins can still manage them, but regular users need to see them for profile creation

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Super admins can view avatar icons" ON avatar_icons;
DROP POLICY IF EXISTS "Super admins can view color palettes" ON color_palettes;

-- Create new policies allowing all authenticated users to view
CREATE POLICY "Authenticated users can view avatar icons"
  ON avatar_icons
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view color palettes"
  ON color_palettes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);