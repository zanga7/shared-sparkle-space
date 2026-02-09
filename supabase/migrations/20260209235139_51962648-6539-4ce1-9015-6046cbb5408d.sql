-- Reset the "new rotating" task's current_member_index so the next rotation picks Luke (index 1)
-- Currently Carla (index 0) has the active task, so current should be 0 (Carla was last assigned)
UPDATE rotating_tasks SET current_member_index = 0 WHERE id = 'd24d099e-68c8-4302-b91a-97e7e5ab76e2';
