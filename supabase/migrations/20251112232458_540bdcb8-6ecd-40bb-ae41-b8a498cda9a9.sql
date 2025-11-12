-- Clear all data for the user's family to start fresh
-- This is a data cleanup operation, not a schema change

DO $$
DECLARE
  user_family_id UUID;
  main_user_id UUID;
BEGIN
  -- Get the family_id and user_id for luke@mezzanine.co
  SELECT p.family_id, u.id INTO user_family_id, main_user_id
  FROM profiles p 
  JOIN auth.users u ON u.id = p.user_id 
  WHERE u.email = 'luke@mezzanine.co' 
  LIMIT 1;

  IF user_family_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Clearing data for family: %', user_family_id;

  -- Delete task-related data
  DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE family_id = user_family_id);
  DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE family_id = user_family_id);
  DELETE FROM tasks WHERE family_id = user_family_id;
  DELETE FROM recurrence_exceptions WHERE series_id IN (SELECT id FROM task_series WHERE family_id = user_family_id) AND series_type = 'task';
  DELETE FROM task_series WHERE family_id = user_family_id;
  DELETE FROM rotation_events WHERE family_id = user_family_id;
  DELETE FROM rotating_tasks WHERE family_id = user_family_id;

  -- Delete event-related data
  DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM events WHERE family_id = user_family_id);
  DELETE FROM recurrence_exceptions WHERE series_id IN (SELECT id FROM event_series WHERE family_id = user_family_id) AND series_type = 'event';
  DELETE FROM events WHERE family_id = user_family_id;
  DELETE FROM event_series WHERE family_id = user_family_id;

  -- Delete reward-related data
  DELETE FROM reward_requests WHERE reward_id IN (SELECT id FROM rewards WHERE family_id = user_family_id);
  DELETE FROM group_contributions WHERE family_id = user_family_id;
  DELETE FROM rewards WHERE family_id = user_family_id;

  -- Delete list-related data
  DELETE FROM list_item_assignees WHERE list_item_id IN (SELECT li.id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.family_id = user_family_id);
  DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE family_id = user_family_id);
  DELETE FROM lists WHERE family_id = user_family_id;
  DELETE FROM list_templates WHERE family_id = user_family_id;

  -- Delete other data
  DELETE FROM categories WHERE family_id = user_family_id;
  DELETE FROM points_ledger WHERE family_id = user_family_id;
  DELETE FROM dashboard_sessions WHERE active_member_id IN (SELECT id FROM profiles WHERE family_id = user_family_id);
  DELETE FROM screensaver_images WHERE family_id = user_family_id;
  DELETE FROM screensaver_settings WHERE family_id = user_family_id;
  DELETE FROM google_photos_integrations WHERE family_id = user_family_id;
  DELETE FROM calendar_token_audit WHERE integration_id IN (SELECT ci.id FROM calendar_integrations ci JOIN profiles p ON p.id = ci.profile_id WHERE p.family_id = user_family_id);
  DELETE FROM calendar_integrations WHERE profile_id IN (SELECT id FROM profiles WHERE family_id = user_family_id);
  DELETE FROM audit_logs WHERE family_id = user_family_id;
  DELETE FROM household_settings WHERE family_id = user_family_id;

  -- Delete all other family member profiles (keep the main user's profile)
  DELETE FROM profiles WHERE family_id = user_family_id AND user_id != main_user_id;

  -- Reset the main user's profile
  UPDATE profiles SET total_points = 0, streak_count = 0 WHERE user_id = main_user_id;

  RAISE NOTICE 'Data cleared successfully for family: %', user_family_id;
END $$;