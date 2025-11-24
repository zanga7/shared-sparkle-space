-- Phase 1: Database Schema Constraints
-- Add check constraint to ensure mutual exclusivity between rotating and recurring tasks
ALTER TABLE tasks ADD CONSTRAINT check_not_both_rotating_and_recurring
  CHECK (
    NOT (rotating_task_id IS NOT NULL AND recurrence_options IS NOT NULL)
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_rotating_task_id 
  ON tasks(rotating_task_id) 
  WHERE rotating_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence 
  ON tasks USING gin(recurrence_options) 
  WHERE recurrence_options IS NOT NULL;

-- Add task_source column to track origin
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_source 
  TEXT CHECK (task_source IN ('manual', 'rotating', 'recurring', 'imported'));

-- Set task_source for existing tasks
UPDATE tasks SET task_source = 'rotating' WHERE rotating_task_id IS NOT NULL AND task_source IS NULL;
UPDATE tasks SET task_source = 'recurring' WHERE recurrence_options IS NOT NULL AND task_source IS NULL;
UPDATE tasks SET task_source = 'manual' WHERE task_source IS NULL;

-- Phase 2: Materialized Task Instances Tracking
-- Create table to track which virtual recurring tasks have been materialized
CREATE TABLE IF NOT EXISTS materialized_task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES task_series(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  materialized_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  materialized_at TIMESTAMPTZ DEFAULT now(),
  materialized_by UUID REFERENCES profiles(id),
  UNIQUE(series_id, occurrence_date)
);

-- Enable RLS on materialized_task_instances
ALTER TABLE materialized_task_instances ENABLE ROW LEVEL SECURITY;

-- Family members can view materialized instances
CREATE POLICY "Family members can view materialized instances"
  ON materialized_task_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_series ts
      JOIN profiles p ON p.family_id = ts.family_id
      WHERE ts.id = materialized_task_instances.series_id
        AND p.user_id = auth.uid()
    )
  );

-- Family members can create materialized instances
CREATE POLICY "Family members can create materialized instances"
  ON materialized_task_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_series ts
      JOIN profiles p ON p.family_id = ts.family_id
      WHERE ts.id = materialized_task_instances.series_id
        AND p.user_id = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_materialized_series_id 
  ON materialized_task_instances(series_id);

CREATE INDEX IF NOT EXISTS idx_materialized_occurrence_date 
  ON materialized_task_instances(occurrence_date);

-- Phase 3: Comprehensive Task Completion RPC
-- This function handles ALL task completion logic in one transaction
CREATE OR REPLACE FUNCTION complete_task_unified(
  p_task_id UUID,
  p_completer_profile_id UUID,
  p_is_virtual BOOLEAN DEFAULT false,
  p_series_id UUID DEFAULT NULL,
  p_occurrence_date DATE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_family_id UUID;
  v_points INTEGER;
  v_completion_id UUID;
  v_materialized_task_id UUID;
  v_rotating_task RECORD;
  v_result jsonb;
BEGIN
  -- If virtual task, materialize it first
  IF p_is_virtual AND p_series_id IS NOT NULL AND p_occurrence_date IS NOT NULL THEN
    -- Check if already materialized
    SELECT materialized_task_id INTO v_materialized_task_id
    FROM materialized_task_instances
    WHERE series_id = p_series_id 
      AND occurrence_date = p_occurrence_date;
    
    IF v_materialized_task_id IS NOT NULL THEN
      -- Already materialized, use existing task
      p_task_id := v_materialized_task_id;
    ELSE
      -- Materialize the virtual task
      SELECT ts.*, ts.family_id, ts.points
      INTO v_task
      FROM task_series ts
      WHERE ts.id = p_series_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Task series not found';
      END IF;
      
      -- Create actual task from series
      INSERT INTO tasks (
        family_id,
        title,
        description,
        points,
        task_group,
        completion_rule,
        due_date,
        created_by,
        task_source
      )
      VALUES (
        v_task.family_id,
        v_task.title,
        v_task.description,
        v_task.points,
        v_task.task_group,
        v_task.completion_rule,
        p_occurrence_date::timestamptz,
        v_task.created_by,
        'recurring'
      )
      RETURNING id INTO v_materialized_task_id;
      
      -- Record materialization
      INSERT INTO materialized_task_instances (
        series_id,
        occurrence_date,
        materialized_task_id,
        materialized_by
      )
      VALUES (
        p_series_id,
        p_occurrence_date,
        v_materialized_task_id,
        p_completer_profile_id
      );
      
      -- Create assignees for materialized task
      INSERT INTO task_assignees (task_id, profile_id, assigned_by)
      SELECT v_materialized_task_id, unnest(v_task.assigned_profiles), v_task.created_by;
      
      p_task_id := v_materialized_task_id;
    END IF;
  END IF;
  
  -- Get task details
  SELECT t.*, t.family_id, t.points, t.rotating_task_id
  INTO v_task
  FROM tasks t
  WHERE t.id = p_task_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  v_family_id := v_task.family_id;
  v_points := v_task.points;
  
  -- Check if already completed by this user
  IF EXISTS (
    SELECT 1 FROM task_completions 
    WHERE task_id = p_task_id 
      AND completed_by = p_completer_profile_id
  ) THEN
    RAISE EXCEPTION 'Task already completed by this user';
  END IF;
  
  -- Create completion record
  INSERT INTO task_completions (task_id, completed_by)
  VALUES (p_task_id, p_completer_profile_id)
  RETURNING id INTO v_completion_id;
  
  -- Award points
  UPDATE profiles 
  SET total_points = total_points + v_points
  WHERE id = p_completer_profile_id;
  
  -- Add to points ledger
  INSERT INTO points_ledger (
    profile_id,
    family_id,
    points,
    task_id,
    created_by,
    entry_type,
    reason
  )
  VALUES (
    p_completer_profile_id,
    v_family_id,
    v_points,
    p_task_id,
    p_completer_profile_id,
    'task_completion',
    'Completed: ' || v_task.title
  );
  
  -- If this is a rotating task, increment the member index
  IF v_task.rotating_task_id IS NOT NULL THEN
    SELECT * INTO v_rotating_task
    FROM rotating_tasks
    WHERE id = v_task.rotating_task_id;
    
    IF FOUND THEN
      -- Increment to next member (with wraparound)
      UPDATE rotating_tasks
      SET current_member_index = (current_member_index + 1) % array_length(member_order, 1),
          updated_at = now()
      WHERE id = v_task.rotating_task_id;
    END IF;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'task_id', p_task_id,
    'points_awarded', v_points,
    'is_rotating', v_task.rotating_task_id IS NOT NULL,
    'materialized', p_is_virtual
  );
  
  RETURN v_result;
END;
$$;