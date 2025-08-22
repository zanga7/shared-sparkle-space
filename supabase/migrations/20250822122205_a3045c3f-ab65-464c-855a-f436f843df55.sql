-- First check if the type exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_request_status') THEN
        CREATE TYPE reward_request_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
    END IF;
END $$;

-- Add 'claimed' value to existing enum
ALTER TYPE reward_request_status ADD VALUE IF NOT EXISTS 'claimed';

-- Function to revoke a reward request and refund points
CREATE OR REPLACE FUNCTION public.revoke_reward_request(request_id_param uuid, revoke_note_param text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  revoker_profile_id UUID;
BEGIN
  -- Get revoker's profile (must be parent)
  SELECT id INTO revoker_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF revoker_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can revoke requests');
  END IF;

  -- Get request details
  SELECT rr.*, r.title as reward_title, r.family_id
  INTO request_record
  FROM public.reward_requests rr
  JOIN public.rewards r ON r.id = rr.reward_id
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE rr.id = request_id_param 
  AND rr.status = 'approved'
  AND p.id = revoker_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;

  -- Update request status to cancelled
  UPDATE public.reward_requests 
  SET 
    status = 'cancelled',
    approval_note = COALESCE(revoke_note_param, 'Reward revoked and points refunded'),
    updated_at = NOW()
  WHERE id = request_id_param;

  -- Refund points by updating total_points directly
  UPDATE public.profiles
  SET total_points = total_points + request_record.points_cost
  WHERE id = request_record.requested_by;

  -- Create ledger entry for refund
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
    'adjust',
    request_record.points_cost,
    'Reward refund: ' || request_record.reward_title,
    request_id_param,
    revoker_profile_id
  );

  RETURN json_build_object('success', true, 'message', 'Reward revoked and points refunded');
END;
$function$;

-- Function to mark reward as claimed
CREATE OR REPLACE FUNCTION public.mark_reward_claimed(request_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  claimer_profile_id UUID;
BEGIN
  -- Get claimer's profile (must be parent)
  SELECT id INTO claimer_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid() AND role = 'parent';
  
  IF claimer_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Only parents can mark rewards as claimed');
  END IF;

  -- Get request details
  SELECT rr.*, r.family_id
  INTO request_record
  FROM public.reward_requests rr
  JOIN public.rewards r ON r.id = rr.reward_id
  JOIN public.profiles p ON p.family_id = r.family_id
  WHERE rr.id = request_id_param 
  AND rr.status = 'approved'
  AND p.id = claimer_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;

  -- Update request status to claimed
  UPDATE public.reward_requests 
  SET 
    status = 'claimed',
    updated_at = NOW()
  WHERE id = request_id_param;

  RETURN json_build_object('success', true, 'message', 'Reward marked as claimed');
END;
$function$;