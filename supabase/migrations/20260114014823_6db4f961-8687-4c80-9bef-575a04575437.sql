-- Add milestone_id column to goal_linked_tasks for per-milestone task linking
ALTER TABLE public.goal_linked_tasks 
ADD COLUMN milestone_id UUID REFERENCES public.goal_milestones(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX idx_goal_linked_tasks_milestone_id ON public.goal_linked_tasks(milestone_id);