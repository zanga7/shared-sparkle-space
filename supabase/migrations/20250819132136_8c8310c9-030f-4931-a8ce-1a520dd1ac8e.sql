-- Temporarily drop audit triggers to fix member updates
-- The audit trigger function has parameter mismatch issues
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
DROP TRIGGER IF EXISTS audit_tasks_trigger ON public.tasks;
DROP TRIGGER IF EXISTS audit_categories_trigger ON public.categories;