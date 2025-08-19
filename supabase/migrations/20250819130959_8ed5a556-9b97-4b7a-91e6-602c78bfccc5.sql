-- Fix security issues by setting search_path for functions

-- Update create_audit_log function with proper search_path
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_family_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    family_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    p_family_id,
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data
  );
END;
$$;

-- Update audit_trigger_function with proper search_path
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  family_id_val UUID;
  actor_id_val UUID;
BEGIN
  -- Get family_id from the record
  IF TG_TABLE_NAME = 'profiles' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'task_series' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  ELSIF TG_TABLE_NAME = 'categories' THEN
    family_id_val := COALESCE(NEW.family_id, OLD.family_id);
  END IF;

  -- Get actor_id (current user)
  actor_id_val := auth.uid();

  -- Create audit log entry
  IF TG_OP = 'DELETE' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD),
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'update',
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.create_audit_log(
      family_id_val,
      actor_id_val,
      'create',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;