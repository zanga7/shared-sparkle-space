
-- Add font family columns to global_style_settings
ALTER TABLE public.global_style_settings
ADD COLUMN IF NOT EXISTS heading_font_family text NOT NULL DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS body_font_family text NOT NULL DEFAULT 'Inter';
