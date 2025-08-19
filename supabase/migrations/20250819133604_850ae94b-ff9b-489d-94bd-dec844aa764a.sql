-- Create task_assignees junction table for multiple assignees per task
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  UNIQUE(task_id, profile_id)
);

-- Enable RLS on task_assignees
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for task_assignees
CREATE POLICY "Family members can view task assignments" 
ON public.task_assignees 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.tasks t
    JOIN public.profiles p ON p.family_id = t.family_id
    WHERE t.id = task_assignees.task_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can manage task assignments" 
ON public.task_assignees 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.tasks t
    JOIN public.profiles p ON p.family_id = t.family_id
    WHERE t.id = task_assignees.task_id 
    AND p.user_id = auth.uid() 
    AND p.role = 'parent'
  )
);

-- Create indexes for better performance
CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_profile_id ON public.task_assignees(profile_id);