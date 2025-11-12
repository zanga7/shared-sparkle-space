-- Rotation infrastructure migration
BEGIN;

-- 1) Add rotating_task_id to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS rotating_task_id UUID REFERENCES public.rotating_tasks(id) ON DELETE SET NULL;

-- 2) Create rotation_events table (idempotent)
CREATE TABLE IF NOT EXISTS public.rotation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  rotating_task_id UUID NOT NULL REFERENCES public.rotating_tasks(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('db_trigger','edge_function','manual','recovery')),
  previous_index INT NULL,
  selected_index INT NULL,
  next_index INT NULL,
  chosen_member_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_task_id UUID NULL REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success','skipped','failed')),
  reason TEXT NULL
);

-- 3) Enable RLS and policies for viewing events within family (parents only)
ALTER TABLE public.rotation_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rotation_events' AND policyname = 'Parents can view rotation events in family'
  ) THEN
    CREATE POLICY "Parents can view rotation events in family"
    ON public.rotation_events
    FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.family_id = rotation_events.family_id
          AND p.role = 'parent'
      )
    );
  END IF;
END $$;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_rotation_events_task ON public.rotation_events(rotating_task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rotation_events_family ON public.rotation_events(family_id, created_at DESC);

-- 5) Backfill rotating_task_id for today based on title/name match (best-effort)
UPDATE public.tasks t
SET rotating_task_id = rt.id
FROM public.rotating_tasks rt
WHERE t.rotating_task_id IS NULL
  AND t.title = rt.name
  AND t.family_id = rt.family_id
  AND t.created_at::date = now()::date;

COMMIT;