-- Add require_parent_pin_for_dashboard to household_settings table
ALTER TABLE household_settings 
ADD COLUMN IF NOT EXISTS require_parent_pin_for_dashboard boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN household_settings.require_parent_pin_for_dashboard IS 'When true, users must enter a parent PIN to access the dashboard';
