-- Create task_series table to group recurring tasks
CREATE TABLE public.task_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  assigned_to UUID,
  recurring_frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  recurring_interval INTEGER NOT NULL DEFAULT 1,
  recurring_days_of_week INTEGER[],
  recurring_end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date TIMESTAMP WITH TIME ZONE,
  next_due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_series ENABLE ROW LEVEL SECURITY;

-- Create policies for task_series
CREATE POLICY "Family members can view task series" 
ON public.task_series 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = task_series.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage task series" 
ON public.task_series 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = task_series.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'::user_role
));

-- Add series_id to tasks table to link to series
ALTER TABLE public.tasks ADD COLUMN series_id UUID REFERENCES public.task_series(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_task_series_family_id ON public.task_series(family_id);
CREATE INDEX idx_task_series_next_due ON public.task_series(next_due_date);
CREATE INDEX idx_tasks_series_id ON public.tasks(series_id);

-- Create trigger for task_series updated_at
CREATE TRIGGER update_task_series_updated_at
BEFORE UPDATE ON public.task_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();