-- Update the approve_reward_request function to use total_points from profiles table instead of points_ledger sum
CREATE OR REPLACE FUNCTION public.approve_reward_request(request_id_param uuid, approval_note_param text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Check current balance using total_points from profiles table (same as frontend)
  SELECT total_points INTO current_balance
  FROM public.profiles
  WHERE id = request_record.requested_by;
  
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

  -- Update total_points in profiles table directly
  UPDATE public.profiles
  SET total_points = total_points - request_record.points_cost
  WHERE id = request_record.requested_by;

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
$function$;