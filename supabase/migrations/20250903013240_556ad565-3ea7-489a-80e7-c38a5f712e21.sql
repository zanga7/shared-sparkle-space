-- Create rotating_tasks table
CREATE TABLE public.rotating_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  weekly_days INTEGER[] DEFAULT ARRAY[1], -- Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  monthly_day INTEGER DEFAULT 1, -- Day of month (1-31)
  member_order UUID[] NOT NULL, -- Array of profile IDs in rotation order
  current_member_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rotating_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Family members can view rotating tasks" 
ON public.rotating_tasks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = rotating_tasks.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage rotating tasks" 
ON public.rotating_tasks 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = rotating_tasks.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = rotating_tasks.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Create trigger for updating updated_at
CREATE TRIGGER update_rotating_tasks_updated_at
BEFORE UPDATE ON public.rotating_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();