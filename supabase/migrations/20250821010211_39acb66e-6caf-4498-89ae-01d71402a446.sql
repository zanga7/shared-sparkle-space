-- Create rotating_tasks table for parent-managed rotating task assignments
CREATE TABLE public.rotating_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  weekly_days INTEGER[] NULL, -- Array of weekday numbers (0=Sunday, 1=Monday, etc.) for weekly cadence
  monthly_day INTEGER NULL, -- Day of month (1-31) for monthly cadence
  member_order UUID[] NOT NULL, -- Array of profile IDs in rotation order
  current_member_index INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 10,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rotating_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for rotating_tasks
CREATE POLICY "Family members can view rotating tasks" 
ON public.rotating_tasks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = rotating_tasks.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage rotating tasks" 
ON public.rotating_tasks 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = rotating_tasks.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Create events table for calendar events (separate from tasks)
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  location TEXT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policies for events
CREATE POLICY "Family members can view events" 
ON public.events 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = events.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Family members can manage events" 
ON public.events 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.family_id = events.family_id 
  AND profiles.user_id = auth.uid()
));

-- Create event_attendees table for many-to-many relationship between events and profiles
CREATE TABLE public.event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID NOT NULL,
  UNIQUE(event_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Create policies for event_attendees
CREATE POLICY "Family members can view event attendees" 
ON public.event_attendees 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN profiles p ON p.family_id = e.family_id
  WHERE e.id = event_attendees.event_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Family members can manage event attendees" 
ON public.event_attendees 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN profiles p ON p.family_id = e.family_id
  WHERE e.id = event_attendees.event_id 
  AND p.user_id = auth.uid()
));

-- Add calendar_integrations table for external calendar sync
CREATE TABLE public.calendar_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('google', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  calendar_id TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for calendar_integrations
CREATE POLICY "Users can manage their own calendar integrations" 
ON public.calendar_integrations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = calendar_integrations.profile_id 
  AND profiles.user_id = auth.uid()
));

-- Create triggers for updated_at columns
CREATE TRIGGER update_rotating_tasks_updated_at
  BEFORE UPDATE ON public.rotating_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_rotating_tasks_family_id ON public.rotating_tasks(family_id);
CREATE INDEX idx_rotating_tasks_active ON public.rotating_tasks(family_id, is_active);
CREATE INDEX idx_events_family_id ON public.events(family_id);
CREATE INDEX idx_events_date_range ON public.events(family_id, start_date, end_date);
CREATE INDEX idx_event_attendees_event_id ON public.event_attendees(event_id);
CREATE INDEX idx_event_attendees_profile_id ON public.event_attendees(profile_id);
CREATE INDEX idx_calendar_integrations_profile_id ON public.calendar_integrations(profile_id);