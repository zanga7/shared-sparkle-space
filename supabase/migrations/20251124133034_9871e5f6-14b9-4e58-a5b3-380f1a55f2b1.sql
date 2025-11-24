-- Clean up completed rotating tasks and reset Mow rotation to start with Milo
-- Hide all completed Mow tasks
UPDATE tasks 
SET hidden_at = NOW()
WHERE title = 'Mow'
  AND rotating_task_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM task_completions tc WHERE tc.task_id = tasks.id
  );

-- Reset the Mow rotating task to index 0 (Milo - first person)
UPDATE rotating_tasks
SET current_member_index = 0
WHERE name = 'Mow';