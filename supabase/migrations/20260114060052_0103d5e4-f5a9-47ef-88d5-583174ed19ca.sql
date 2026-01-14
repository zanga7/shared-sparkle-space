-- Fix the "mile stone" milestone to not be completed
UPDATE goal_milestones 
SET is_completed = false, completed_at = null 
WHERE id = '10a18aa0-d65e-485b-8984-6d31538ca54f';