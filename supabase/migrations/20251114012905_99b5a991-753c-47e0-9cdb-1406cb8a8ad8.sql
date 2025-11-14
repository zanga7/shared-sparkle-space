-- Create celebrations table
CREATE TABLE celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  celebration_type TEXT NOT NULL CHECK (celebration_type IN ('birthday', 'anniversary', 'other')),
  celebration_date DATE NOT NULL,
  year_specific INTEGER,
  visual_type TEXT NOT NULL CHECK (visual_type IN ('photo', 'icon')),
  photo_url TEXT,
  icon_id UUID REFERENCES avatar_icons(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Add indexes for celebrations
CREATE INDEX idx_celebrations_family ON celebrations(family_id);
CREATE INDEX idx_celebrations_date ON celebrations(celebration_date);

-- Enable RLS on celebrations
ALTER TABLE celebrations ENABLE ROW LEVEL SECURITY;

-- Family members can view celebrations
CREATE POLICY "family_members_view_celebrations" ON celebrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.family_id = celebrations.family_id 
      AND profiles.user_id = auth.uid()
    )
  );

-- Parents can manage celebrations
CREATE POLICY "parents_manage_celebrations" ON celebrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.family_id = celebrations.family_id 
      AND profiles.user_id = auth.uid() 
      AND profiles.role = 'parent'
    )
  );

-- Extend avatar_icons table for celebration icons
ALTER TABLE avatar_icons ADD COLUMN IF NOT EXISTS icon_type TEXT DEFAULT 'avatar' 
  CHECK (icon_type IN ('avatar', 'celebration'));

-- Create index for icon type
CREATE INDEX IF NOT EXISTS idx_avatar_icons_type ON avatar_icons(icon_type);

-- Create public holiday settings table
CREATE TABLE public_holiday_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  api_provider TEXT NOT NULL CHECK (api_provider IN ('nager', 'calendarific', 'holidayapi')),
  api_key TEXT,
  enabled_regions JSONB DEFAULT '[]',
  last_sync_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on public_holiday_settings
ALTER TABLE public_holiday_settings ENABLE ROW LEVEL SECURITY;

-- Parents can manage holiday settings
CREATE POLICY "parents_manage_holiday_settings" ON public_holiday_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.family_id = public_holiday_settings.family_id 
      AND profiles.user_id = auth.uid() 
      AND profiles.role = 'parent'
    )
  );

-- Create public holidays cache table
CREATE TABLE public_holidays_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  holiday_type TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  year INTEGER NOT NULL,
  UNIQUE(region_code, holiday_date)
);

-- Add indexes for holidays cache
CREATE INDEX idx_holidays_region_year ON public_holidays_cache(region_code, year);
CREATE INDEX idx_holidays_date ON public_holidays_cache(holiday_date);

-- Enable RLS on public_holidays_cache
ALTER TABLE public_holidays_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view holidays
CREATE POLICY "authenticated_view_holidays" ON public_holidays_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create storage bucket for celebration photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('celebration-photos', 'celebration-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for celebration photos storage
CREATE POLICY "family_upload_celebration_photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'celebration-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "family_view_celebration_photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'celebration-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "family_delete_celebration_photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'celebration-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

-- Seed default celebration icons (only if they don't exist)
INSERT INTO avatar_icons (name, svg_content, icon_type, is_system)
SELECT * FROM (VALUES
  ('Birthday Cake', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12C21 10.34 19.66 9 18 9z"/></svg>', 'celebration', true),
  ('Party Popper', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 8.5L10.5 6 9 4.5 6.5 7 5 5.5 4.5 9 8 8.5zm7-2.5L13.5 4.5 12 6l1.5 1.5L15 6zM5.5 15l2.5-2.5L7 11l-3.5.5L5.5 15zM19 7l-2-2-1.41 1.41 2 2L19 7zM21 11l-3.5.5L16 15l2.5-2.5L21 11zM11 9L9.5 7.5 7 10l1.5 1.5L11 9zm4.5 2l-1.5-1.5L11.5 12 13 13.5 14.5 11zm-1 4.5L13 14l-2.5 2.5L12 18l1.5-1.5zM11.5 16L9 13.5 7.5 15 10 17.5l1.5-1.5zm7.39-4.97l.58.58a.996.996 0 0 1 0 1.41l-6.36 6.36a.996.996 0 0 1-1.41 0L8.35 15.5l1.42-1.41 2.12 2.12 5.66-5.66 1.34 1.48z"/></svg>', 'celebration', true),
  ('Heart', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>', 'celebration', true),
  ('Gift', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>', 'celebration', true),
  ('Balloons', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm1 14h-2v-1h2v1zm2.5-4.5c-.29.4-.64.74-1.04 1.03-.4.28-.87.5-1.4.64-.53.14-1.1.21-1.71.21-.61 0-1.18-.07-1.71-.21-.53-.14-1-.36-1.4-.64-.4-.29-.75-.63-1.04-1.03-.29-.4-.51-.84-.66-1.31-.15-.47-.23-.99-.23-1.55 0-1.1.45-2.1 1.17-2.83.72-.73 1.72-1.17 2.83-1.17s2.11.44 2.83 1.17c.72.73 1.17 1.73 1.17 2.83 0 .56-.08 1.08-.23 1.55-.15.47-.37.91-.66 1.31z"/></svg>', 'celebration', true),
  ('Star', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>', 'celebration', true)
) AS v(name, svg_content, icon_type, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM avatar_icons WHERE avatar_icons.name = v.name AND avatar_icons.icon_type = 'celebration'
);