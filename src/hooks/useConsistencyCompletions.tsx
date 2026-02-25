import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Goal } from '@/types/goal';

interface ConsistencyCompletionsData {
  completionsByMember: Record<string, string[]>;
  allCompletedDates: string[];
}

interface UseConsistencyCompletionsResult extends ConsistencyCompletionsData {
  loading: boolean;
}

async function fetchConsistencyData(goal: Goal): Promise<ConsistencyCompletionsData> {
  const linkedSeries = goal.linked_tasks?.filter(lt => lt.task_series_id) || [];
  const linkedTaskIds = goal.linked_tasks?.filter(lt => lt.task_id).map(lt => lt.task_id!) || [];
  
  const startDate = goal.start_date;
  const endDate = goal.end_date || new Date().toISOString().split('T')[0];
  
  const result: Record<string, string[]> = {};
  const allDates: string[] = [];
  
  // For series-linked tasks: query task_completions directly via materialized instances
  // AND also check for completions on tasks that share the series_id
  for (const link of linkedSeries) {
    if (!link.task_series_id) continue;
    
    // Approach: Find all task_completions for tasks that belong to this series,
    // using materialized_task_instances to map task_id -> occurrence_date.
    // This works for already-materialized instances.
    const { data: materializedCompletions } = await supabase
      .from('materialized_task_instances')
      .select(`
        occurrence_date,
        materialized_task_id,
        tasks:materialized_task_id (
          task_completions (
            completed_by,
            completed_at
          )
        )
      `)
      .eq('series_id', link.task_series_id)
      .gte('occurrence_date', startDate)
      .lte('occurrence_date', endDate);
    
    if (materializedCompletions) {
      for (const inst of materializedCompletions) {
        const tasks = inst.tasks as any;
        const completions = tasks?.task_completions || [];
        for (const c of completions) {
          if (!result[c.completed_by]) result[c.completed_by] = [];
          if (!result[c.completed_by].includes(inst.occurrence_date)) {
            result[c.completed_by].push(inst.occurrence_date);
          }
          if (!allDates.includes(inst.occurrence_date)) {
            allDates.push(inst.occurrence_date);
          }
        }
      }
    }
    
    // Also check for completions on tasks with due_date matching occurrence dates
    // that were materialized but might not have a materialized_task_instances row yet.
    // This handles the case where complete_task_unified created the task+completion
    // but the hook didn't find it above (e.g., race condition or missing row).
    const { data: directTasks } = await supabase
      .from('tasks')
      .select(`
        id,
        due_date,
        task_completions (
          completed_by,
          completed_at
        )
      `)
      .eq('task_source', 'recurring')
      .gte('due_date', startDate)
      .lte('due_date', endDate + 'T23:59:59');
    
    if (directTasks) {
      // Filter to only tasks that belong to this series via materialized_task_instances
      const taskIds = directTasks.map(t => t.id);
      if (taskIds.length > 0) {
        const { data: seriesLinks } = await supabase
          .from('materialized_task_instances')
          .select('materialized_task_id, occurrence_date')
          .eq('series_id', link.task_series_id)
          .in('materialized_task_id', taskIds);
        
        const taskToDate: Record<string, string> = {};
        (seriesLinks || []).forEach(sl => {
          if (sl.materialized_task_id) {
            taskToDate[sl.materialized_task_id] = sl.occurrence_date;
          }
        });
        
        for (const task of directTasks) {
          const occDate = taskToDate[task.id];
          if (!occDate) continue;
          
          for (const c of (task.task_completions || [])) {
            if (!result[c.completed_by]) result[c.completed_by] = [];
            if (!result[c.completed_by].includes(occDate)) {
              result[c.completed_by].push(occDate);
            }
            if (!allDates.includes(occDate)) {
              allDates.push(occDate);
            }
          }
        }
      }
    }
  }
  
  // Also fetch completions from directly linked tasks (non-series)
  if (linkedTaskIds.length > 0) {
    const { data: directCompletions } = await supabase
      .from('task_completions')
      .select('task_id, completed_by, completed_at')
      .in('task_id', linkedTaskIds);
    
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, due_date')
      .in('id', linkedTaskIds);
    
    const taskDueDates: Record<string, string> = {};
    (tasks || []).forEach(t => {
      if (t.due_date) taskDueDates[t.id] = t.due_date.split('T')[0];
    });
    
    (directCompletions || []).forEach(c => {
      const completionDate = c.completed_at.split('T')[0];
      const taskDate = taskDueDates[c.task_id] || completionDate;
      
      if (!result[c.completed_by]) result[c.completed_by] = [];
      if (!result[c.completed_by].includes(taskDate)) {
        result[c.completed_by].push(taskDate);
      }
      if (!allDates.includes(taskDate)) {
        allDates.push(taskDate);
      }
    });
  }
  
  return { completionsByMember: result, allCompletedDates: allDates.sort() };
}

export function useConsistencyCompletions(goal: Goal | null): UseConsistencyCompletionsResult {
  const queryClient = useQueryClient();
  const goalId = goal?.id;
  const isConsistency = goal?.goal_type === 'consistency';

  // Listen for task-updated events to invalidate this specific query
  useEffect(() => {
    if (!goalId) return;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['consistency-completions', goalId] });
    };
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [goalId, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['consistency-completions', goalId],
    queryFn: () => fetchConsistencyData(goal!),
    enabled: !!goalId && isConsistency,
    staleTime: 30_000,
  });

  return {
    completionsByMember: data?.completionsByMember ?? {},
    allCompletedDates: data?.allCompletedDates ?? [],
    loading: isLoading,
  };
}
