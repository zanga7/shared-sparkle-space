-- Add kawaii face settings to global_style_settings
ALTER TABLE global_style_settings
ADD COLUMN IF NOT EXISTS kawaii_faces_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS kawaii_animations_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS kawaii_face_style text DEFAULT 'line',
ADD COLUMN IF NOT EXISTS kawaii_animation_frequency text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS kawaii_min_animate_size integer DEFAULT 30;