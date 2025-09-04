-- Clean up duplicate recurring tasks that were created without proper assignees
DELETE FROM public.tasks 
WHERE title LIKE '%(%' 
AND assigned_to IS NULL 
AND recurrence_options IS NULL;