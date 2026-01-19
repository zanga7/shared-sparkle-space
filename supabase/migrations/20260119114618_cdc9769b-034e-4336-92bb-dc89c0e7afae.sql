-- Create global style settings table
CREATE TABLE public.global_style_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton pattern
  -- Page Headings
  page_heading_size TEXT NOT NULL DEFAULT 'text-3xl',
  page_heading_weight TEXT NOT NULL DEFAULT 'font-bold',
  page_heading_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Section Headings
  section_heading_size TEXT NOT NULL DEFAULT 'text-2xl',
  section_heading_weight TEXT NOT NULL DEFAULT 'font-semibold',
  section_heading_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Card Titles
  card_title_size TEXT NOT NULL DEFAULT 'text-lg',
  card_title_weight TEXT NOT NULL DEFAULT 'font-semibold',
  card_title_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Dialog Titles
  dialog_title_size TEXT NOT NULL DEFAULT 'text-lg',
  dialog_title_weight TEXT NOT NULL DEFAULT 'font-semibold',
  dialog_title_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Body Text
  body_text_size TEXT NOT NULL DEFAULT 'text-base',
  body_text_weight TEXT NOT NULL DEFAULT 'font-normal',
  body_text_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Small/Helper Text
  small_text_size TEXT NOT NULL DEFAULT 'text-sm',
  small_text_weight TEXT NOT NULL DEFAULT 'font-normal',
  small_text_color TEXT NOT NULL DEFAULT 'text-muted-foreground',
  -- Label Text
  label_text_size TEXT NOT NULL DEFAULT 'text-sm',
  label_text_weight TEXT NOT NULL DEFAULT 'font-medium',
  label_text_color TEXT NOT NULL DEFAULT 'text-foreground',
  -- Button Text
  button_text_size TEXT NOT NULL DEFAULT 'text-sm',
  button_text_weight TEXT NOT NULL DEFAULT 'font-medium',
  -- Border Radius
  border_radius TEXT NOT NULL DEFAULT '0.75rem',
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default values
INSERT INTO public.global_style_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.global_style_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read style settings
CREATE POLICY "Anyone can read style settings"
ON public.global_style_settings
FOR SELECT
TO authenticated
USING (true);

-- Only super admins can update
CREATE POLICY "Super admins can update style settings"
ON public.global_style_settings
FOR UPDATE
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Create trigger to update timestamp
CREATE TRIGGER update_global_style_settings_updated_at
BEFORE UPDATE ON public.global_style_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();