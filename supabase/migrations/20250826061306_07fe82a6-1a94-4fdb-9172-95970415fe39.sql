-- Create screen saver settings table
CREATE TABLE public.screensaver_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_duration INTEGER NOT NULL DEFAULT 30, -- seconds to display each image
  transition_effect TEXT NOT NULL DEFAULT 'fade',
  show_clock BOOLEAN NOT NULL DEFAULT true,
  show_weather BOOLEAN NOT NULL DEFAULT false,
  brightness INTEGER NOT NULL DEFAULT 75, -- percentage
  google_photos_connected BOOLEAN NOT NULL DEFAULT false,
  google_photos_album_id TEXT,
  custom_images_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create screensaver images table for custom uploaded images
CREATE TABLE public.screensaver_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Google Photos integration tracking
CREATE TABLE public.google_photos_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  album_id TEXT,
  album_name TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.screensaver_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screensaver_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_photos_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for screensaver_settings
CREATE POLICY "Family members can view screensaver settings"
ON public.screensaver_settings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_settings.family_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage screensaver settings"
ON public.screensaver_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_settings.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_settings.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
));

-- Create RLS policies for screensaver_images
CREATE POLICY "Family members can view screensaver images"
ON public.screensaver_images FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_images.family_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage screensaver images"
ON public.screensaver_images FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_images.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = screensaver_images.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
));

-- Create RLS policies for google_photos_integrations
CREATE POLICY "Family members can view Google Photos integrations"
ON public.google_photos_integrations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = google_photos_integrations.family_id
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage Google Photos integrations"
ON public.google_photos_integrations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = google_photos_integrations.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.family_id = google_photos_integrations.family_id
  AND profiles.user_id = auth.uid()
  AND profiles.role = 'parent'
));

-- Create storage bucket for screensaver images
INSERT INTO storage.buckets (id, name, public)
VALUES ('screensaver-images', 'screensaver-images', true);

-- Create storage policies for screensaver images
CREATE POLICY "Family members can view screensaver images"
ON storage.objects FOR SELECT
USING (bucket_id = 'screensaver-images' AND EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN public.screensaver_images si ON si.family_id = p.family_id
  WHERE si.file_path = name AND p.user_id = auth.uid()
));

CREATE POLICY "Parents can upload screensaver images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screensaver-images' AND EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'parent'
));

CREATE POLICY "Parents can update screensaver images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'screensaver-images' AND EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN public.screensaver_images si ON si.family_id = p.family_id
  WHERE si.file_path = name AND p.user_id = auth.uid() AND p.role = 'parent'
));

CREATE POLICY "Parents can delete screensaver images"
ON storage.objects FOR DELETE
USING (bucket_id = 'screensaver-images' AND EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN public.screensaver_images si ON si.family_id = p.family_id
  WHERE si.file_path = name AND p.user_id = auth.uid() AND p.role = 'parent'
));

-- Create function to update timestamps
CREATE TRIGGER update_screensaver_settings_updated_at
BEFORE UPDATE ON public.screensaver_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_screensaver_images_updated_at
BEFORE UPDATE ON public.screensaver_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_photos_integrations_updated_at
BEFORE UPDATE ON public.google_photos_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();