-- Un-hide the two tasks that were uncompleted from goals but still have hidden_at set
UPDATE public.tasks 
SET hidden_at = NULL 
WHERE id IN ('bfd4b5e1-11f7-4c3d-8d33-8e9d6664ec57', 'dbe8ea81-e06e-4293-a625-1925ad5c6ba5')
  AND hidden_at IS NOT NULL;