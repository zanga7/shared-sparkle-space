-- Enable realtime for task_assignees and task_completions tables
-- This is required for the frontend realtime subscriptions to work

-- Add task_assignees to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE task_assignees;

-- Add task_completions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Enabled realtime for task_assignees and task_completions tables';
END $$;