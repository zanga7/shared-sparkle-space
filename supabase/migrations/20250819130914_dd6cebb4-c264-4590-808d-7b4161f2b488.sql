-- Create audit log table for tracking all changes
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL, -- user who performed the action
  action TEXT NOT NULL, -- create, update, delete, etc.
  entity_type TEXT NOT NULL, -- tasks, profiles, etc.
  entity_id UUID, -- id of the affected entity
  old_data JSONB, -- previous state
  new_data JSONB, -- new state
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs (parents can view family audit logs)
CREATE POLICY "Parents can view family audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = audit_logs.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Add permissions columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_add_for_self BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_add_for_siblings BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_add_for_parents BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'sky' CHECK (color IN ('sky', 'rose', 'emerald', 'amber', 'violet')),
ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pin_hash TEXT, -- for kid authentication
ADD COLUMN IF NOT EXISTS failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS theme JSONB; -- optional theme preferences

-- Create household settings table
CREATE TABLE public.household_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE UNIQUE,
  subscription_metadata JSONB, -- for future subscription features
  theme_palette JSONB NOT NULL DEFAULT '["sky", "rose", "emerald", "amber", "violet"]',
  pin_attempts_limit INTEGER NOT NULL DEFAULT 3,
  pin_lockout_duration INTEGER NOT NULL DEFAULT 300, -- 5 minutes in seconds
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on household settings
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for household settings (parents can manage)
CREATE POLICY "Parents can manage household settings" 
ON public.household_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = household_settings.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Create categories table for task organization
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'sky' CHECK (color IN ('sky', 'rose', 'emerald', 'amber', 'violet')),
  icon TEXT, -- icon name for display
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(family_id, name)
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY "Family members can view categories" 
ON public.categories 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = categories.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage categories" 
ON public.categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = categories.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Add category_id to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create function to create audit log entries
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

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create audit triggers for key tables
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_tasks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Create indexes for performance
CREATE INDEX idx_audit_logs_family_id ON public.audit_logs(family_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_profiles_family_status ON public.profiles(family_id, status);
CREATE INDEX idx_categories_family_active ON public.categories(family_id, is_active);