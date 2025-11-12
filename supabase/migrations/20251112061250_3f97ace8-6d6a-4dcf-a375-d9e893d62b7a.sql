-- Add rotating_task_id to tasks table for stable linking
ALTER TABLE public.tasks
ADD COLUMN rotating_task_id UUID REFERENCES public.rotating_tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_rotating_task_id ON public.tasks(rotating_task_id);

-- Create rotation_events table for comprehensive logging
CREATE TABLE public.rotation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  rotating_task_id UUID NOT NULL REFERENCES public.rotating_tasks(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('db_trigger', 'edge_function', 'manual', 'recovery')),
  previous_index INTEGER,
  selected_index INTEGER,
  next_index INTEGER,
  chosen_member_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  reason TEXT
);

CREATE INDEX idx_rotation_events_rotating_task_id ON public.rotation_events(rotating_task_id);
CREATE INDEX idx_rotation_events_created_at ON public.rotation_events(created_at DESC);
CREATE INDEX idx_rotation_events_family_id ON public.rotation_events(family_id);

-- RLS policies for rotation_events
ALTER TABLE public.rotation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view rotation events"
  ON public.rotation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.family_id = rotation_events.family_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert rotation events"
  ON public.rotation_events
  FOR INSERT
  WITH CHECK (true);

-- Update handle_rotating_task_completion trigger to be atomic and use stable linking
CREATE OR REPLACE FUNCTION public.handle_rotating_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rotating_task_record RECORD;
  task_record RECORD;
  original_index INTEGER;
  selected_index INTEGER;
  next_index INTEGER;
  chosen_member_id UUID;
  new_task_id UUID;
  task_date DATE;
  len INTEGER;
  candidate_id UUID;
  candidate_valid BOOLEAN;
  due_timestamp TIMESTAMPTZ;
BEGIN
  -- Get the completed task details
  SELECT t.*, rt.*
  INTO task_record
  FROM public.tasks t
  LEFT JOIN public.rotating_tasks rt ON rt.id = t.rotating_task_id
  WHERE t.id = NEW.task_id;

  -- Only proceed if this is a rotating task
  IF task_record.rotating_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the rotating_tasks row for atomic rotation
  SELECT *
  INTO rotating_task_record
  FROM public.rotating_tasks
  WHERE id = task_record.rotating_task_id
  FOR UPDATE;

  -- Check if task should be generated (respect cadence)
  task_date := CURRENT_DATE;
  
  -- Check cadence rules
  IF rotating_task_record.cadence = 'weekly' THEN
    IF NOT (EXTRACT(ISODOW FROM task_date) = ANY(rotating_task_record.weekly_days)) THEN
      RETURN NEW; -- Not a valid day for this weekly task
    END IF;
  ELSIF rotating_task_record.cadence = 'monthly' THEN
    IF EXTRACT(DAY FROM task_date) != rotating_task_record.monthly_day THEN
      RETURN NEW; -- Not the correct day of month
    END IF;
  END IF;

  original_index := rotating_task_record.current_member_index;
  len := array_length(rotating_task_record.member_order, 1);
  
  IF len IS NULL OR len = 0 THEN
    INSERT INTO public.rotation_events (
      family_id, rotating_task_id, source, previous_index, status, reason
    ) VALUES (
      rotating_task_record.family_id, rotating_task_record.id, 'db_trigger', 
      original_index, 'failed', 'Empty member_order'
    );
    RETURN NEW;
  END IF;

  -- Find next valid member starting from next index
  chosen_member_id := NULL;
  selected_index := (original_index + 1) % len;
  
  FOR i IN 0..(len - 1) LOOP
    selected_index := (original_index + 1 + i) % len;
    candidate_id := rotating_task_record.member_order[selected_index + 1]; -- Arrays are 1-indexed
    
    -- Validate candidate exists in profiles for this family
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE id = candidate_id
      AND family_id = rotating_task_record.family_id
    ) INTO candidate_valid;
    
    IF candidate_valid THEN
      chosen_member_id := candidate_id;
      EXIT;
    END IF;
  END LOOP;

  IF chosen_member_id IS NULL THEN
    INSERT INTO public.rotation_events (
      family_id, rotating_task_id, source, previous_index, selected_index, status, reason
    ) VALUES (
      rotating_task_record.family_id, rotating_task_record.id, 'db_trigger',
      original_index, selected_index, 'failed', 'No valid members in rotation'
    );
    RETURN NEW;
  END IF;

  -- Calculate due date based on task_group
  due_timestamp := task_date::TIMESTAMPTZ;
  CASE rotating_task_record.task_group
    WHEN 'morning' THEN due_timestamp := due_timestamp + INTERVAL '9 hours';
    WHEN 'midday' THEN due_timestamp := due_timestamp + INTERVAL '12 hours';
    WHEN 'afternoon' THEN due_timestamp := due_timestamp + INTERVAL '15 hours';
    WHEN 'evening' THEN due_timestamp := due_timestamp + INTERVAL '18 hours';
    ELSE due_timestamp := due_timestamp + INTERVAL '23 hours 59 minutes';
  END CASE;

  -- Create the new task
  INSERT INTO public.tasks (
    family_id, title, description, points, due_date, created_by, task_group, rotating_task_id
  ) VALUES (
    rotating_task_record.family_id,
    rotating_task_record.name,
    rotating_task_record.description,
    rotating_task_record.points,
    due_timestamp,
    rotating_task_record.created_by,
    rotating_task_record.task_group,
    rotating_task_record.id
  )
  RETURNING id INTO new_task_id;

  -- Assign to chosen member
  INSERT INTO public.task_assignees (task_id, profile_id, assigned_by)
  VALUES (new_task_id, chosen_member_id, rotating_task_record.created_by);

  -- Update current_member_index
  next_index := (selected_index + 1) % len;
  UPDATE public.rotating_tasks
  SET current_member_index = next_index, updated_at = NOW()
  WHERE id = rotating_task_record.id;

  -- Log successful rotation
  INSERT INTO public.rotation_events (
    family_id, rotating_task_id, source, previous_index, selected_index, 
    next_index, chosen_member_id, new_task_id, status
  ) VALUES (
    rotating_task_record.family_id, rotating_task_record.id, 'db_trigger',
    original_index, selected_index, next_index, chosen_member_id, new_task_id, 'success'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log failed rotation
    INSERT INTO public.rotation_events (
      family_id, rotating_task_id, source, previous_index, status, reason
    ) VALUES (
      rotating_task_record.family_id, rotating_task_record.id, 'db_trigger',
      original_index, 'failed', SQLERRM
    );
    RETURN NEW;
END;
$$;

-- Backfill rotating_task_id for existing tasks (match by title and family_id)
UPDATE public.tasks t
SET rotating_task_id = rt.id
FROM public.rotating_tasks rt
WHERE t.title = rt.name
  AND t.family_id = rt.family_id
  AND t.rotating_task_id IS NULL
  AND t.created_at >= CURRENT_DATE - INTERVAL '7 days';