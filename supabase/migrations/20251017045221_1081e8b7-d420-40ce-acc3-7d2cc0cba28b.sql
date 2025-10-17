-- Phase 1: Add EXDATE support and recurrence_id for RFC 5545 compliance

-- Add EXDATE arrays to series tables
ALTER TABLE event_series ADD COLUMN IF NOT EXISTS exdates date[] DEFAULT '{}';
ALTER TABLE task_series ADD COLUMN IF NOT EXISTS exdates date[] DEFAULT '{}';

-- Add recurrence_id for modified instances (for .ics export compatibility)
ALTER TABLE recurrence_exceptions ADD COLUMN IF NOT EXISTS recurrence_id timestamptz;

-- Add index for performance on exception queries
CREATE INDEX IF NOT EXISTS idx_recurrence_exceptions_series_date 
  ON recurrence_exceptions(series_id, series_type, exception_date);

-- Add helpful comments
COMMENT ON COLUMN event_series.exdates IS 'Array of dates (YYYY-MM-DD) that are excluded from the series (EXDATE in RFC 5545)';
COMMENT ON COLUMN task_series.exdates IS 'Array of dates (YYYY-MM-DD) that are excluded from the series (EXDATE in RFC 5545)';
COMMENT ON COLUMN recurrence_exceptions.recurrence_id IS 'Timestamp identifying which specific occurrence this exception applies to (for .ics RECURRENCE-ID)';

-- Function to add an EXDATE to a series
CREATE OR REPLACE FUNCTION add_exdate_to_series(
  p_series_id UUID,
  p_table_name TEXT,
  p_exdate DATE
) RETURNS VOID AS $$
BEGIN
  IF p_table_name = 'event_series' THEN
    UPDATE event_series 
    SET exdates = array_append(exdates, p_exdate)
    WHERE id = p_series_id
    AND NOT (p_exdate = ANY(exdates)); -- Prevent duplicates
  ELSIF p_table_name = 'task_series' THEN
    UPDATE task_series 
    SET exdates = array_append(exdates, p_exdate)
    WHERE id = p_series_id
    AND NOT (p_exdate = ANY(exdates));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to remove an EXDATE from a series
CREATE OR REPLACE FUNCTION remove_exdate_from_series(
  p_series_id UUID,
  p_table_name TEXT,
  p_exdate DATE
) RETURNS VOID AS $$
BEGIN
  IF p_table_name = 'event_series' THEN
    UPDATE event_series 
    SET exdates = array_remove(exdates, p_exdate)
    WHERE id = p_series_id;
  ELSIF p_table_name = 'task_series' THEN
    UPDATE task_series 
    SET exdates = array_remove(exdates, p_exdate)
    WHERE id = p_series_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;