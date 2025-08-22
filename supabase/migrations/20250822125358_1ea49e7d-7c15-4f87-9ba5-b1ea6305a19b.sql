-- Add auto_approve setting to rewards table
ALTER TABLE public.rewards 
ADD COLUMN auto_approve boolean NOT NULL DEFAULT false;