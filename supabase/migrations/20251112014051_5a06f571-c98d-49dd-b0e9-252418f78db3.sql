-- Add auto_return_enabled column to household_settings
ALTER TABLE household_settings 
ADD COLUMN auto_return_enabled boolean NOT NULL DEFAULT true;