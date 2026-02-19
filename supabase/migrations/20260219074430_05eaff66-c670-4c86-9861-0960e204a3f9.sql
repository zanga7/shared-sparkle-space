
-- Add text transform columns for each heading type
ALTER TABLE public.global_style_settings
  ADD COLUMN page_heading_transform text NOT NULL DEFAULT 'uppercase',
  ADD COLUMN section_heading_transform text NOT NULL DEFAULT 'uppercase',
  ADD COLUMN card_title_transform text NOT NULL DEFAULT 'none',
  ADD COLUMN dialog_title_transform text NOT NULL DEFAULT 'none';
