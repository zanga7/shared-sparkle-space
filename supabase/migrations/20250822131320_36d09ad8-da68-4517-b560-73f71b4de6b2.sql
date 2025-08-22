-- Fix group rewards to create requests for all assigned members
CREATE OR REPLACE FUNCTION public.handle_group_contribution_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  reward_record RECORD;
  contribution_count INTEGER;
  required_contributors INTEGER;
  assigned_member_id UUID;
BEGIN
  -- Get the reward details
  SELECT * INTO reward_record
  FROM public.rewards 
  WHERE id = NEW.reward_id AND reward_type = 'group_contribution';
  
  -- If not a group contribution reward, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get required number of contributors (based on assigned_to array length, or 1 if null)
  required_contributors := COALESCE(array_length(reward_record.assigned_to, 1), 1);
  
  -- Count unique contributors who have contributed the full amount
  SELECT COUNT(DISTINCT profile_id) INTO contribution_count
  FROM public.group_contributions
  WHERE reward_id = NEW.reward_id 
  AND points_contributed >= reward_record.cost_points;
  
  -- If we have enough contributors, mark reward as inactive and create approval for all members
  IF contribution_count >= required_contributors THEN
    -- Deactivate the reward
    UPDATE public.rewards 
    SET is_active = false, updated_at = NOW()
    WHERE id = NEW.reward_id;
    
    -- Create reward requests for all assigned members with 'approved' status
    IF reward_record.assigned_to IS NOT NULL THEN
      -- Loop through all assigned members
      FOREACH assigned_member_id IN ARRAY reward_record.assigned_to
      LOOP
        INSERT INTO public.reward_requests (
          reward_id,
          requested_by,
          points_cost,
          status,
          approval_note,
          created_at,
          updated_at
        ) VALUES (
          NEW.reward_id,
          assigned_member_id,
          0, -- No points cost as they've already been deducted via contributions
          'approved',
          'Group contribution goal completed automatically',
          NOW(),
          NOW()
        );
      END LOOP;
    ELSE
      -- Fallback: create one request for the completing contributor
      INSERT INTO public.reward_requests (
        reward_id,
        requested_by,
        points_cost,
        status,
        approval_note,
        created_at,
        updated_at
      ) VALUES (
        NEW.reward_id,
        NEW.profile_id,
        0,
        'approved',
        'Group contribution goal completed automatically',
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;