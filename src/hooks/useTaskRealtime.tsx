import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';

interface UseTaskRealtimeProps {
  familyId: string | null;
  onTaskInserted: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
  onCompletionAdded: (taskId: string, completion: any) => void;
  onCompletionRemoved: (taskId: string, completionId: string) => void;
  onCompletionUpdated?: (taskId: string, completion: any) => void;
  onSeriesChanged: () => void;
}

/**
 * Centralized hook for task-related realtime subscriptions.
 * Handles: task inserts (with retry for assignee hydration), task completions
 * (insert/delete/update), task assignee inserts, and series/exception changes.
 */
export function useTaskRealtime({
  familyId,
  onTaskInserted,
  onTaskUpdated,
  onCompletionAdded,
  onCompletionRemoved,
  onCompletionUpdated,
  onSeriesChanged
}: UseTaskRealtimeProps) {
  
  // Subscribe to task inserts (with retry logic for assignee hydration)
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
          console.log('🔔 [REALTIME] New task INSERT detected:', {
            taskId: payload.new.id,
            title: (payload.new as any).title,
            rotating_task_id: (payload.new as any).rotating_task_id
          });

          // Add delay to ensure task_assignees are committed by database triggers
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('⏱️ [REALTIME] Waited 100ms, now fetching full task data...');

          // Fetch full task data with relations (exclude hidden tasks)
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

          // Retry once if assignees are not yet available (race-safe hydration)
          let hydratedTask = newTaskData;
          if (hydratedTask && (!hydratedTask.assignees || hydratedTask.assignees.length === 0)) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            const { data: retryData } = await supabase
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
            if (retryData) hydratedTask = retryData;
          }

          if (hydratedTask) {
            console.log('✅ [REALTIME] Task data fetched:', {
              taskId: hydratedTask.id,
              title: hydratedTask.title,
              assigneesCount: hydratedTask.assignees?.length || 0,
              assignees: hydratedTask.assignees?.map((a: any) => a.profile?.display_name)
            });

            onTaskInserted({
              ...hydratedTask,
              completion_rule: (hydratedTask.completion_rule || 'everyone') as 'any_one' | 'everyone'
            } as unknown as Task);
          } else {
            console.error('❌ [REALTIME] Failed to fetch task data');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, onTaskInserted]);

  // Subscribe to task completions (INSERT, DELETE, UPDATE)
  useEffect(() => {
    if (!familyId) return;

    const completionsChannel = supabase
      .channel('task-completions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_completions' },
        (payload) => {
          console.log('🔔 [REALTIME] Task completion INSERT detected:', {
            taskId: (payload.new as any).task_id,
            completedBy: (payload.new as any).completed_by
          });
          onCompletionAdded((payload.new as any).task_id, payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'task_completions' },
        (payload) => {
          console.log('🔔 [REALTIME] Task completion DELETE detected:', {
            completionId: (payload.old as any).id,
            taskId: (payload.old as any).task_id
          });
          onCompletionRemoved((payload.old as any).task_id, (payload.old as any).id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'task_completions' },
        (payload) => {
          console.log('🔔 Task completion updated via realtime:', payload.new);
          if (onCompletionUpdated) {
            onCompletionUpdated((payload.new as any).task_id, payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(completionsChannel);
    };
  }, [familyId, onCompletionAdded, onCompletionRemoved, onCompletionUpdated]);

  // Subscribe to series changes
  useEffect(() => {
    if (!familyId) return;

    const seriesChannel = supabase
      .channel('series-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_series', filter: `family_id=eq.${familyId}` },
        () => {
          console.log('🛰️ [REALTIME] task_series change detected, refreshing');
          onSeriesChanged();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recurrence_exceptions' },
        () => {
          console.log('🛰️ [REALTIME] recurrence_exceptions change detected, refreshing');
          onSeriesChanged();
        }
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
          try {
            console.log('🔔 [REALTIME] Task assignee INSERT detected:', {
              taskId: (payload.new as any).task_id,
              profileId: (payload.new as any).profile_id
            });

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
              console.log('✅ [REALTIME] Task assignee data fetched:', {
                taskId: taskData.id,
                assigneesCount: taskData.assignees?.length || 0
              });

              onTaskUpdated({
                ...taskData,
                completion_rule: (taskData.completion_rule || 'everyone') as 'any_one' | 'everyone'
              } as unknown as Task);
            } else {
              console.log('⚠️ [REALTIME] Task not in family or not found');
            }
          } catch (e) {
            console.error('❌ [REALTIME] Failed to update task after assignee insert', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assigneesChannel);
    };
  }, [familyId, onTaskUpdated]);
}
