-- Reset all family member points and ensure all data is cleared
DO $$
DECLARE
  user_family_id UUID;
BEGIN
  -- Get the family_id for luke@mezzanine.co
  SELECT p.family_id INTO user_family_id
  FROM profiles p 
  JOIN auth.users u ON u.id = p.user_id 
  WHERE u.email = 'luke@mezzanine.co' 
  LIMIT 1;

  IF user_family_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Resetting points for family: %', user_family_id;

  -- Ensure all task-related data is cleared
  DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE family_id = user_family_id);
  DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE family_id = user_family_id);
  DELETE FROM tasks WHERE family_id = user_family_id;
  DELETE FROM task_series WHERE family_id = user_family_id;
  DELETE FROM rotating_tasks WHERE family_id = user_family_id;
  DELETE FROM rotation_events WHERE family_id = user_family_id;

  -- Ensure all event data is cleared
  DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM events WHERE family_id = user_family_id);
  DELETE FROM events WHERE family_id = user_family_id;
  DELETE FROM event_series WHERE family_id = user_family_id;

  -- Ensure all reward data is cleared
  DELETE FROM reward_requests WHERE reward_id IN (SELECT id FROM rewards WHERE family_id = user_family_id);
  DELETE FROM group_contributions WHERE family_id = user_family_id;
  DELETE FROM rewards WHERE family_id = user_family_id;

  -- Ensure all list data is cleared
  DELETE FROM list_item_assignees WHERE list_item_id IN (SELECT li.id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.family_id = user_family_id);
  DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE family_id = user_family_id);
  DELETE FROM lists WHERE family_id = user_family_id;

  -- Clear points ledger
  DELETE FROM points_ledger WHERE family_id = user_family_id;

  -- Reset ALL family member profiles to 0 points
  UPDATE profiles 
  SET total_points = 0, streak_count = 0 
  WHERE family_id = user_family_id;

  RAISE NOTICE 'All points reset and data cleared for family: %', user_family_id;
END $$;