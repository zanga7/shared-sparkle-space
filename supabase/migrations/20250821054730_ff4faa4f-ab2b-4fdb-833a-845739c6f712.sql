-- Create reward type enum
CREATE TYPE public.reward_type AS ENUM ('once_off', 'always_available', 'group_contribution');

-- Update rewards table to use the new enum
ALTER TABLE public.rewards ALTER COLUMN reward_type TYPE public.reward_type USING reward_type::public.reward_type;

-- Create table to track group contribution progress
CREATE TABLE IF NOT EXISTS public.group_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  points_contributed INTEGER NOT NULL DEFAULT 0,
  contributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  family_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on group_contributions
ALTER TABLE public.group_contributions ENABLE ROW LEVEL SECURITY;

-- Create policies for group_contributions
CREATE POLICY "Family members can view group contributions" 
ON public.group_contributions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = group_contributions.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Family members can create group contributions" 
ON public.group_contributions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = group_contributions.family_id 
  AND profiles.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_group_contributions_updated_at
BEFORE UPDATE ON public.group_contributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();