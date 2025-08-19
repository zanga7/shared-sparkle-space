-- Add recurring functionality fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN recurring_frequency text DEFAULT NULL CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly')),
ADD COLUMN recurring_interval integer DEFAULT 1 CHECK (recurring_interval > 0),
ADD COLUMN recurring_days_of_week integer[] DEFAULT NULL,
ADD COLUMN recurring_end_date timestamp with time zone DEFAULT NULL;