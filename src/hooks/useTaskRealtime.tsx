import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

interface UseTaskRealtimeProps {
  familyId: string | null;
  onTaskInserted: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  onCompletionAdded: (taskId: string, completion: any) => void;
  onCompletionRemoved: (taskId: string, completionId: string) => void;
  onSeriesChanged: () => void;
}

/**
 * Centralized hook for task-related realtime subscriptions
 * Extracts subscription logic from ColumnBasedDashboard for better maintainability
 */
export function useTaskRealtime({
  familyId,
  onTaskInserted,
  onTaskUpdated,
  onCompletionAdded,
  onCompletionRemoved,
  onSeriesChanged
}: UseTaskRealtimeProps) {
  
  // Subscribe to task inserts
  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel('tasks-changes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${familyId}`
        },
        async (payload) => {
          // Add delay to ensure task_assignees are committed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Fetch full task data with relations
          const { data: newTaskData } = await supabase
            .from('tasks')
            .select(`
              id, title, description, points, due_date, assigned_to, created_by,
              completion_rule, task_group, task_source, rotating_task_id,
              assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
              assignees:task_assignees(id, profile_id, assigned_at, assigned_by, 
                profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
              task_completions(id, completed_at, completed_by)
            `)
            .eq('id', payload.new.id)
            .is('hidden_at', null)
            .single();

          if (newTaskData) {
            onTaskInserted({
              ...newTaskData,
              completion_rule: (newTaskData.completion_rule || 'everyone') as 'any_one' | 'everyone'
            } as unknown as Task);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, onTaskInserted]);

  // Subscribe to task completions
  useEffect(() => {
    if (!familyId) return;

    const completionsChannel = supabase
      .channel('task-completions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_completions' },
        (payload) => {
          onCompletionAdded((payload.new as any).task_id, payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'task_completions' },
        (payload) => {
          onCompletionRemoved((payload.old as any).task_id, (payload.old as any).id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(completionsChannel);
    };
  }, [familyId, onCompletionAdded, onCompletionRemoved]);

  // Subscribe to series changes
  useEffect(() => {
    if (!familyId) return;

    const seriesChannel = supabase
      .channel('series-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_series', filter: `family_id=eq.${familyId}` },
        () => onSeriesChanged()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recurrence_exceptions' },
        () => onSeriesChanged()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(seriesChannel);
    };
  }, [familyId, onSeriesChanged]);

  // Subscribe to task assignee changes
  useEffect(() => {
    if (!familyId) return;

    const assigneesChannel = supabase
      .channel('task-assignees-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_assignees' },
        async (payload) => {
          const { data: taskData } = await supabase
            .from('tasks')
            .select(`
              id, title, description, points, due_date, assigned_to, created_by,
              completion_rule, task_group, task_source, rotating_task_id, family_id,
              assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
              assignees:task_assignees(id, profile_id, assigned_at, assigned_by, 
                profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
              task_completions(id, completed_at, completed_by)
            `)
            .eq('id', (payload.new as any).task_id)
            .is('hidden_at', null)
            .single();

          if (taskData && taskData.family_id === familyId) {
            onTaskUpdated({
              ...taskData,
              completion_rule: (taskData.completion_rule || 'everyone') as 'any_one' | 'everyone'
            } as unknown as Task);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assigneesChannel);
    };
  }, [familyId, onTaskUpdated]);
}
