-- Create series tables for proper recurring behavior
-- This implements the single source of truth approach

-- Task Series table
CREATE TABLE IF NOT EXISTS public.task_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  created_by UUID NOT NULL,
  
  -- Series metadata
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  task_group TEXT DEFAULT 'general',
  completion_rule TEXT DEFAULT 'everyone',
  
  -- Recurrence rule (single source of truth)
  recurrence_rule JSONB NOT NULL,
  
  -- Series lifecycle
  series_start TIMESTAMPTZ NOT NULL,
  series_end TIMESTAMPTZ, -- When the series ends (for split series)
  original_series_id UUID, -- Reference to original if this is a "this and following" split
  
  -- Assignees for the series
  assigned_profiles UUID[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Event Series table
CREATE TABLE IF NOT EXISTS public.event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  created_by UUID NOT NULL,
  
  -- Series metadata
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  
  -- Recurrence rule (single source of truth)
  recurrence_rule JSONB NOT NULL,
  
  -- Series lifecycle
  series_start TIMESTAMPTZ NOT NULL,
  series_end TIMESTAMPTZ, -- When the series ends (for split series)
  original_series_id UUID, -- Reference to original if this is a "this and following" split
  
  -- Event timing
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Attendees for the series
  attendee_profiles UUID[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Exceptions table for overrides and skips
CREATE TABLE IF NOT EXISTS public.recurrence_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL,
  series_type TEXT NOT NULL CHECK (series_type IN ('task', 'event')),
  exception_date DATE NOT NULL, -- The date this exception applies to
  exception_type TEXT NOT NULL CHECK (exception_type IN ('skip', 'override')),
  
  -- Override data (only for override type)
  override_data JSONB, -- Contains the modified event/task data
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL
);

-- Add foreign key constraints
ALTER TABLE public.task_series ADD CONSTRAINT task_series_original_series_fkey 
  FOREIGN KEY (original_series_id) REFERENCES public.task_series(id) ON DELETE CASCADE;

ALTER TABLE public.event_series ADD CONSTRAINT event_series_original_series_fkey 
  FOREIGN KEY (original_series_id) REFERENCES public.event_series(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_series_family_id ON public.task_series(family_id);
CREATE INDEX IF NOT EXISTS idx_task_series_active ON public.task_series(is_active);
CREATE INDEX IF NOT EXISTS idx_event_series_family_id ON public.event_series(family_id);
CREATE INDEX IF NOT EXISTS idx_event_series_active ON public.event_series(is_active);
CREATE INDEX IF NOT EXISTS idx_recurrence_exceptions_series ON public.recurrence_exceptions(series_id, series_type);
CREATE INDEX IF NOT EXISTS idx_recurrence_exceptions_date ON public.recurrence_exceptions(exception_date);

-- Add RLS policies for security
ALTER TABLE public.task_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrence_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS for task_series
CREATE POLICY "Family members can view task series" ON public.task_series 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = task_series.family_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can manage task series" ON public.task_series 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = task_series.family_id 
    AND profiles.user_id = auth.uid() 
    AND profiles.role = 'parent'
  )
);

-- RLS for event_series
CREATE POLICY "Family members can view event series" ON public.event_series 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = event_series.family_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Family members can manage event series" ON public.event_series 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.family_id = event_series.family_id 
    AND profiles.user_id = auth.uid()
  )
);

-- RLS for recurrence_exceptions
CREATE POLICY "Family members can view exceptions" ON public.recurrence_exceptions 
FOR SELECT USING (
  CASE 
    WHEN series_type = 'task' THEN EXISTS (
      SELECT 1 FROM public.task_series ts 
      JOIN public.profiles p ON p.family_id = ts.family_id
      WHERE ts.id = recurrence_exceptions.series_id 
      AND p.user_id = auth.uid()
    )
    WHEN series_type = 'event' THEN EXISTS (
      SELECT 1 FROM public.event_series es 
      JOIN public.profiles p ON p.family_id = es.family_id
      WHERE es.id = recurrence_exceptions.series_id 
      AND p.user_id = auth.uid()
    )
  END
);

CREATE POLICY "Family members can manage exceptions" ON public.recurrence_exceptions 
FOR ALL USING (
  CASE 
    WHEN series_type = 'task' THEN EXISTS (
      SELECT 1 FROM public.task_series ts 
      JOIN public.profiles p ON p.family_id = ts.family_id
      WHERE ts.id = recurrence_exceptions.series_id 
      AND p.user_id = auth.uid() 
      AND (p.role = 'parent' OR ts.created_by = p.id)
    )
    WHEN series_type = 'event' THEN EXISTS (
      SELECT 1 FROM public.event_series es 
      JOIN public.profiles p ON p.family_id = es.family_id
      WHERE es.id = recurrence_exceptions.series_id 
      AND p.user_id = auth.uid()
    )
  END
);

-- Add updated_at triggers
CREATE TRIGGER update_task_series_updated_at
  BEFORE UPDATE ON public.task_series
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_series_updated_at
  BEFORE UPDATE ON public.event_series
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();