-- Add completed_tasks_hide_hours setting to household_settings
ALTER TABLE household_settings 
ADD COLUMN IF NOT EXISTS completed_tasks_hide_hours INTEGER DEFAULT 12;

COMMENT ON COLUMN household_settings.completed_tasks_hide_hours IS 'Number of hours after completion before tasks are automatically hidden';