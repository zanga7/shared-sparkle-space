-- Add status column to families table
ALTER TABLE public.families 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_families_status ON public.families(status);

-- Create avatar_icons table
CREATE TABLE IF NOT EXISTS public.avatar_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  svg_content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create color_palettes table
CREATE TABLE IF NOT EXISTS public.color_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color_key TEXT NOT NULL UNIQUE,
  hsl_value TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert existing avatar icons
INSERT INTO public.avatar_icons (name, svg_content, is_system) VALUES
  ('av1', '<!-- placeholder -->', true),
  ('av2', '<!-- placeholder -->', true),
  ('av3', '<!-- placeholder -->', true),
  ('av4', '<!-- placeholder -->', true),
  ('av5', '<!-- placeholder -->', true),
  ('av6', '<!-- placeholder -->', true)
ON CONFLICT (name) DO NOTHING;

-- Insert existing color palettes
INSERT INTO public.color_palettes (name, color_key, hsl_value, is_system) VALUES
  ('Sky', 'sky', '199 89% 48%', true),
  ('Rose', 'rose', '350 89% 60%', true),
  ('Emerald', 'emerald', '160 84% 39%', true),
  ('Amber', 'amber', '38 92% 50%', true),
  ('Violet', 'violet', '258 90% 66%', true)
ON CONFLICT (color_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.avatar_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.color_palettes ENABLE ROW LEVEL SECURITY;

-- RLS policies for super admin access
CREATE POLICY "Super admins can view avatar icons"
  ON public.avatar_icons FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can manage avatar icons"
  ON public.avatar_icons FOR ALL
  USING (is_super_admin());

CREATE POLICY "Super admins can view color palettes"
  ON public.color_palettes FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can manage color palettes"
  ON public.color_palettes FOR ALL
  USING (is_super_admin());

-- Add updated_at trigger
CREATE TRIGGER update_avatar_icons_updated_at
  BEFORE UPDATE ON public.avatar_icons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_color_palettes_updated_at
  BEFORE UPDATE ON public.color_palettes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();