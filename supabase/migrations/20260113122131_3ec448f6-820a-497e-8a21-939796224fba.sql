-- Phase 1: Goals Module Database Schema

-- 1.1 Add 'goals' to app_module enum
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'goals';

-- 1.2 Create goal-specific enums
CREATE TYPE goal_type AS ENUM ('consistency', 'target_count', 'project');
CREATE TYPE goal_scope AS ENUM ('individual', 'family');
CREATE TYPE goal_status AS ENUM ('active', 'paused', 'completed', 'archived');

-- 1.3 Create goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_type goal_type NOT NULL,
  goal_scope goal_scope NOT NULL DEFAULT 'individual',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES rewards(id) ON DELETE SET NULL,
  success_criteria JSONB NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status goal_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 Create goal_milestones table
CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  milestone_order INT NOT NULL DEFAULT 0,
  completion_criteria JSONB NOT NULL,
  reward_id UUID REFERENCES rewards(id) ON DELETE SET NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.5 Create goal_linked_tasks table
CREATE TABLE public.goal_linked_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_series_id UUID REFERENCES task_series(id) ON DELETE SET NULL,
  rotating_task_id UUID REFERENCES rotating_tasks(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by UUID NOT NULL REFERENCES profiles(id),
  CONSTRAINT at_least_one_task CHECK (
    task_id IS NOT NULL OR task_series_id IS NOT NULL OR rotating_task_id IS NOT NULL
  )
);

-- 1.6 Create goal_progress_snapshots table
CREATE TABLE public.goal_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  progress_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, snapshot_date)
);

-- 1.7 Create indexes for performance
CREATE INDEX idx_goals_family_id ON goals(family_id);
CREATE INDEX idx_goals_assigned_to ON goals(assigned_to);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX idx_goal_linked_tasks_goal_id ON goal_linked_tasks(goal_id);
CREATE INDEX idx_goal_linked_tasks_task_id ON goal_linked_tasks(task_id);
CREATE INDEX idx_goal_linked_tasks_task_series_id ON goal_linked_tasks(task_series_id);
CREATE INDEX idx_goal_linked_tasks_rotating_task_id ON goal_linked_tasks(rotating_task_id);
CREATE INDEX idx_goal_progress_snapshots_goal_id ON goal_progress_snapshots(goal_id);

-- 1.8 Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_linked_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_snapshots ENABLE ROW LEVEL SECURITY;

-- 1.9 RLS Policies for goals
CREATE POLICY "Users can view goals in their family"
ON public.goals FOR SELECT
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create goals in their family"
ON public.goals FOR INSERT
WITH CHECK (
  family_id IN (
    SELECT family_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Goal creators and parents can update goals"
ON public.goals FOR UPDATE
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE user_id = auth.uid()
  )
  AND (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND family_id = goals.family_id 
      AND role = 'parent'
    )
  )
);

CREATE POLICY "Goal creators and parents can delete goals"
ON public.goals FOR DELETE
USING (
  family_id IN (
    SELECT family_id FROM profiles WHERE user_id = auth.uid()
  )
  AND (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND family_id = goals.family_id 
      AND role = 'parent'
    )
  )
);

-- 1.10 RLS Policies for goal_milestones (inherit from parent goal)
CREATE POLICY "Users can view milestones for goals in their family"
ON public.goal_milestones FOR SELECT
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage milestones for their goals"
ON public.goal_milestones FOR ALL
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- 1.11 RLS Policies for goal_linked_tasks
CREATE POLICY "Users can view linked tasks for goals in their family"
ON public.goal_linked_tasks FOR SELECT
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage linked tasks for their goals"
ON public.goal_linked_tasks FOR ALL
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- 1.12 RLS Policies for goal_progress_snapshots
CREATE POLICY "Users can view progress for goals in their family"
ON public.goal_progress_snapshots FOR SELECT
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage progress for their goals"
ON public.goal_progress_snapshots FOR ALL
USING (
  goal_id IN (
    SELECT id FROM goals WHERE family_id IN (
      SELECT family_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- 1.13 Create updated_at trigger for goals
CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 1.14 Create updated_at trigger for goal_milestones
CREATE TRIGGER update_goal_milestones_updated_at
BEFORE UPDATE ON public.goal_milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();