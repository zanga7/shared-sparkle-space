-- Clean up test families - delete goal_linked_tasks first, then tasks
DO $$
DECLARE
    keep_user_id UUID;
    keep_family_id UUID;
    family_to_delete RECORD;
BEGIN
    SELECT id INTO keep_user_id FROM auth.users WHERE email = 'luke@mezzanine.co';
    SELECT family_id INTO keep_family_id FROM profiles WHERE user_id = keep_user_id;
    
    FOR family_to_delete IN SELECT id FROM families WHERE id != keep_family_id
    LOOP
        -- Delete goal_linked_tasks FIRST (before tasks)
        DELETE FROM goal_linked_tasks WHERE goal_id IN (SELECT id FROM goals WHERE family_id = family_to_delete.id);
        DELETE FROM goal_milestones WHERE goal_id IN (SELECT id FROM goals WHERE family_id = family_to_delete.id);
        DELETE FROM goal_assignees WHERE goal_id IN (SELECT id FROM goals WHERE family_id = family_to_delete.id);
        DELETE FROM goal_progress_snapshots WHERE goal_id IN (SELECT id FROM goals WHERE family_id = family_to_delete.id);
        DELETE FROM goals WHERE family_id = family_to_delete.id;
        
        -- Now delete tasks
        DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE family_id = family_to_delete.id);
        DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE family_id = family_to_delete.id);
        DELETE FROM tasks WHERE family_id = family_to_delete.id;
        DELETE FROM materialized_task_instances WHERE series_id IN (SELECT id FROM task_series WHERE family_id = family_to_delete.id);
        DELETE FROM task_series WHERE family_id = family_to_delete.id;
        DELETE FROM rotation_events WHERE family_id = family_to_delete.id;
        DELETE FROM rotating_tasks WHERE family_id = family_to_delete.id;
        DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM events WHERE family_id = family_to_delete.id);
        DELETE FROM event_series WHERE family_id = family_to_delete.id;
        DELETE FROM events WHERE family_id = family_to_delete.id;
        DELETE FROM list_item_assignees WHERE list_item_id IN (SELECT id FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE family_id = family_to_delete.id));
        DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE family_id = family_to_delete.id);
        DELETE FROM lists WHERE family_id = family_to_delete.id;
        DELETE FROM reward_requests WHERE reward_id IN (SELECT id FROM rewards WHERE family_id = family_to_delete.id);
        DELETE FROM group_contributions WHERE family_id = family_to_delete.id;
        DELETE FROM rewards WHERE family_id = family_to_delete.id;
        DELETE FROM celebrations WHERE family_id = family_to_delete.id;
        DELETE FROM categories WHERE family_id = family_to_delete.id;
        DELETE FROM holiday_dates WHERE family_id = family_to_delete.id;
        DELETE FROM points_ledger WHERE family_id = family_to_delete.id;
        DELETE FROM public_holiday_settings WHERE family_id = family_to_delete.id;
        DELETE FROM household_settings WHERE family_id = family_to_delete.id;
        DELETE FROM family_module_overrides WHERE family_id = family_to_delete.id;
        DELETE FROM calendar_integrations WHERE profile_id IN (SELECT id FROM profiles WHERE family_id = family_to_delete.id);
        DELETE FROM dashboard_sessions WHERE active_member_id IN (SELECT id FROM profiles WHERE family_id = family_to_delete.id);
        DELETE FROM profiles WHERE family_id = family_to_delete.id;
        DELETE FROM families WHERE id = family_to_delete.id;
    END LOOP;
END $$;

-- Delete auth users except luke@mezzanine.co
DELETE FROM auth.users WHERE email != 'luke@mezzanine.co';