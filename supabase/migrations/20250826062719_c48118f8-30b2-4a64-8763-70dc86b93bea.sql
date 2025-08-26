-- Add timeout_minutes column to screensaver_settings table
ALTER TABLE public.screensaver_settings 
ADD COLUMN timeout_minutes integer NOT NULL DEFAULT 5;