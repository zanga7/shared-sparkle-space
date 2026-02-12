UPDATE public.global_style_settings 
SET 
  page_heading_size = 'text-5xl',
  section_heading_size = 'text-3xl',
  card_title_size = 'text-xl',
  dialog_title_size = 'text-xl',
  updated_at = now()
WHERE id = 1;