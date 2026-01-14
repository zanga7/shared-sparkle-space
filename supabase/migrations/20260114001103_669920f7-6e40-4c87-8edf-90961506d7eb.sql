-- Create goal_assignees table for multi-member assignment (similar to task_assignees)
CREATE TABLE public.goal_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(goal_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.goal_assignees ENABLE ROW LEVEL SECURITY;

-- Users can view goal assignees in their family
CREATE POLICY "Users can view goal assignees in their family"
ON public.goal_assignees
FOR SELECT
USING (
  goal_id IN (
    SELECT goals.id FROM goals
    WHERE goals.family_id IN (
      SELECT profiles.family_id FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
);

-- Users can manage goal assignees in their family
CREATE POLICY "Users can manage goal assignees in their family"
ON public.goal_assignees
FOR ALL
USING (
  goal_id IN (
    SELECT goals.id FROM goals
    WHERE goals.family_id IN (
      SELECT profiles.family_id FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  goal_id IN (
    SELECT goals.id FROM goals
    WHERE goals.family_id IN (
      SELECT profiles.family_id FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
);

-- Create index for faster lookups
CREATE INDEX idx_goal_assignees_goal_id ON public.goal_assignees(goal_id);
CREATE INDEX idx_goal_assignees_profile_id ON public.goal_assignees(profile_id);