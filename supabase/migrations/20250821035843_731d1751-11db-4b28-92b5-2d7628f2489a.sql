-- Create rewards table
CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  image_url TEXT,
  reward_type TEXT NOT NULL DEFAULT 'always_available' CHECK (reward_type IN ('once_off', 'always_available')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_to UUID[], -- Array of profile IDs, null means available to all
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reward requests table
CREATE TABLE public.reward_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  points_cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  approved_by UUID,
  approval_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create points ledger table
CREATE TABLE public.points_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  family_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earn', 'spend', 'adjust')),
  points INTEGER NOT NULL, -- Positive for earn, negative for spend/adjust down
  reason TEXT NOT NULL,
  task_id UUID, -- Reference to task if points earned from task
  reward_request_id UUID, -- Reference to reward request if points spent on reward
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rewards
CREATE POLICY "Family members can view rewards" 
ON public.rewards 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = rewards.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can manage rewards" 
ON public.rewards 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = rewards.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- RLS Policies for reward requests
CREATE POLICY "Family members can view reward requests" 
ON public.reward_requests 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.rewards r
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE r.id = reward_requests.reward_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create their own reward requests" 
ON public.reward_requests 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = reward_requests.requested_by 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Users can update their own pending requests" 
ON public.reward_requests 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = reward_requests.requested_by 
  AND profiles.user_id = auth.uid()
  AND reward_requests.status = 'pending'
));

CREATE POLICY "Parents can manage all reward requests" 
ON public.reward_requests 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.rewards r
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE r.id = reward_requests.reward_id 
  AND p.user_id = auth.uid() 
  AND p.role = 'parent'
));

-- RLS Policies for points ledger
CREATE POLICY "Family members can view ledger entries" 
ON public.points_ledger 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = points_ledger.family_id 
  AND profiles.user_id = auth.uid()
));

CREATE POLICY "Parents can create ledger entries" 
ON public.points_ledger 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.family_id = points_ledger.family_id 
  AND profiles.user_id = auth.uid() 
  AND profiles.role = 'parent'
));

-- Create indexes for performance
CREATE INDEX idx_rewards_family_id ON public.rewards(family_id);
CREATE INDEX idx_rewards_active ON public.rewards(family_id, is_active);
CREATE INDEX idx_reward_requests_status ON public.reward_requests(status);
CREATE INDEX idx_reward_requests_requested_by ON public.reward_requests(requested_by);
CREATE INDEX idx_points_ledger_profile_id ON public.points_ledger(profile_id);
CREATE INDEX idx_points_ledger_family_id ON public.points_ledger(family_id);
CREATE INDEX idx_points_ledger_created_at ON public.points_ledger(created_at DESC);

-- Create trigger for updated_at columns
CREATE TRIGGER update_rewards_updated_at
BEFORE UPDATE ON public.rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reward_requests_updated_at
BEFORE UPDATE ON public.reward_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate current points balance
CREATE OR REPLACE FUNCTION public.get_profile_points_balance(profile_id_param UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)
  FROM public.points_ledger
  WHERE profile_id = profile_id_param;
$$;

-- Function to approve reward request
CREATE OR REPLACE FUNCTION public.approve_reward_request(
  request_id_param UUID,
  approval_note_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
  current_balance INTEGER;
  approver_profile_id UUID;
BEGIN
  -- Get approver's profile
  SELECT id INTO approver_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF approver_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can approve requests');
  END IF;

  -- Get request details with reward info
  SELECT rr.*, r.cost_points, r.title as reward_title, r.family_id
  INTO request_record
  FROM public.reward_requests rr
  JOIN public.rewards r ON r.id = rr.reward_id
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE rr.id = request_id_param 
  AND rr.status = 'pending'
  AND p.id = approver_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  -- Check current balance
  current_balance := public.get_profile_points_balance(request_record.requested_by);
  
  IF current_balance < request_record.points_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points balance');
  END IF;

  -- Update request status
  UPDATE public.reward_requests 
  SET 
    status = 'approved',
    approved_by = approver_profile_id,
    approval_note = approval_note_param,
    updated_at = NOW()
  WHERE id = request_id_param;

  -- Create ledger entry for spending points
  INSERT INTO public.points_ledger (
    profile_id,
    family_id,
    entry_type,
    points,
    reason,
    reward_request_id,
    created_by
  ) VALUES (
    request_record.requested_by,
    request_record.family_id,
    'spend',
    -request_record.points_cost,
    'Reward: ' || request_record.reward_title,
    request_id_param,
    approver_profile_id
  );

  RETURN json_build_object('success', true, 'message', 'Reward request approved');
END;
$$;