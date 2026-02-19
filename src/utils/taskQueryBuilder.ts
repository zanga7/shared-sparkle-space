import { supabase } from '@/integrations/supabase/client';
import type { Task } from '@/types/task';

/**
 * Shared task select shape used across the codebase.
 * Single source of truth — update here when task columns change.
 */
export const TASK_SELECT_SHAPE = `
  id, title, description, points, due_date, assigned_to, created_by,
  completion_rule, task_group, task_source, rotating_task_id, hidden_at, family_id,
  assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color, avatar_url),
  assignees:task_assignees(id, profile_id, assigned_at, assigned_by,
    profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color, avatar_url)),
  task_completions(id, completed_at, completed_by)
`.trim();

/**
 * Casts a raw task row from Supabase into the typed Task shape,
 * defaulting completion_rule to 'everyone'.
 */
export function castTask(row: any): Task {
  return {
    ...row,
    completion_rule: (row.completion_rule || 'everyone') as 'any_one' | 'everyone',
  } as unknown as Task;
}

/**
 * Casts an array of raw task rows.
 */
export function castTasks(rows: any[]): Task[] {
  return rows.map(castTask);
}

/**
 * Build a standard task query filtered by family.
 * Caller can chain additional filters before awaiting.
 */
export function buildFamilyTaskQuery(familyId: string, { excludeHidden = true } = {}) {
  let query = supabase
    .from('tasks')
    .select(TASK_SELECT_SHAPE)
    .eq('family_id', familyId);

  if (excludeHidden) {
    query = query.is('hidden_at', null);
  }

  return query;
}

/**
 * Fetch a single task by ID with the standard shape.
 */
export function buildSingleTaskQuery(taskId: string, { excludeHidden = true } = {}) {
  let query = supabase
    .from('tasks')
    .select(TASK_SELECT_SHAPE)
    .eq('id', taskId);

  if (excludeHidden) {
    query = query.is('hidden_at', null);
  }

  return query.single();
}
