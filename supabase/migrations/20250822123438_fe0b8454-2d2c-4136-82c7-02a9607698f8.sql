-- Fix the reward_requests status constraint to include 'claimed'
ALTER TABLE public.reward_requests 
DROP CONSTRAINT IF EXISTS reward_requests_status_check;

ALTER TABLE public.reward_requests 
ADD CONSTRAINT reward_requests_status_check 
CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'claimed'));