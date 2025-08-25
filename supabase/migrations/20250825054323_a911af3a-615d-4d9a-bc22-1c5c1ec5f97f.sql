-- Remove list_type column from lists table since we're using categories instead
ALTER TABLE public.lists DROP COLUMN IF EXISTS list_type;