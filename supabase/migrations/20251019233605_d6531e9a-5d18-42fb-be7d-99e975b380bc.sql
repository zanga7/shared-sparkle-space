-- Add unique constraint to prevent duplicate exceptions for the same series/date
-- This will allow upsert (ON CONFLICT DO UPDATE) operations
ALTER TABLE recurrence_exceptions 
ADD CONSTRAINT recurrence_exceptions_series_date_unique 
UNIQUE (series_id, series_type, exception_date);