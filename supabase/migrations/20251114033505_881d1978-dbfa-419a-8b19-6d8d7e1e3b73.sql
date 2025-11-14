-- Add onboarding completion tracking to household_settings
ALTER TABLE household_settings 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_household_settings_onboarding 
ON household_settings(onboarding_completed);

COMMENT ON COLUMN household_settings.onboarding_completed IS 'Tracks whether the family has completed the onboarding flow';
COMMENT ON COLUMN household_settings.onboarding_completed_at IS 'Timestamp when onboarding was completed or skipped';