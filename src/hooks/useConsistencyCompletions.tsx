import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Goal } from '@/types/goal';

interface UseConsistencyCompletionsResult {
  completionsByMember: Record<string, string[]>;
  allCompletedDates: string[];
  loading: boolean;
}

export function useConsistencyCompletions(goal: Goal | null): UseConsistencyCompletionsResult {
  const [completionsByMember, setCompletionsByMember] = useState<Record<string, string[]>>({});
  const [allCompletedDates, setAllCompletedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!goal || goal.goal_type !== 'consistency') {
      setCompletionsByMember({});
      setAllCompletedDates([]);
      return;
    }

    const fetchCompletions = async () => {
      setLoading(true);
      
      try {
        // Get the linked task series for this goal
        const linkedSeries = goal.linked_tasks?.filter(lt => lt.task_series_id) || [];
        const linkedTaskIds = goal.linked_tasks?.filter(lt => lt.task_id).map(lt => lt.task_id!) || [];
        
        const startDate = goal.start_date;
        const endDate = goal.end_date || new Date().toISOString().split('T')[0];
        
        const result: Record<string, string[]> = {};
        const allDates: string[] = [];
        
        // Fetch completions from task series
        for (const link of linkedSeries) {
          if (!link.task_series_id) continue;
          
          // Get materialized task instances for this series
          const { data: instances } = await supabase
            .from('materialized_task_instances')
            .select('occurrence_date, materialized_task_id')
            .eq('series_id', link.task_series_id)
            .gte('occurrence_date', startDate)
            .lte('occurrence_date', endDate);
          
          if (!instances || instances.length === 0) continue;
          
          // Get task IDs that have materialized instances
          const taskIds = instances
            .map(i => i.materialized_task_id)
            .filter(Boolean) as string[];
          
          if (taskIds.length === 0) continue;
          
          // Get completions for those tasks
          const { data: completions } = await supabase
            .from('task_completions')
            .select('task_id, completed_by, completed_at')
            .in('task_id', taskIds);
          
          // Build completion lookup by task_id
          const completionsByTask: Record<string, { completed_by: string; completed_at: string }[]> = {};
          (completions || []).forEach(c => {
            if (!completionsByTask[c.task_id]) completionsByTask[c.task_id] = [];
            completionsByTask[c.task_id].push({ completed_by: c.completed_by, completed_at: c.completed_at });
          });
          
          // Map back to member -> dates
          instances.forEach(instance => {
            if (!instance.materialized_task_id) return;
            const taskCompletions = completionsByTask[instance.materialized_task_id] || [];
            taskCompletions.forEach(c => {
              if (!result[c.completed_by]) result[c.completed_by] = [];
              if (!result[c.completed_by].includes(instance.occurrence_date)) {
                result[c.completed_by].push(instance.occurrence_date);
              }
              if (!allDates.includes(instance.occurrence_date)) {
                allDates.push(instance.occurrence_date);
              }
            });
          });
        }
        
        // Also fetch completions from directly linked tasks (non-series)
        if (linkedTaskIds.length > 0) {
          const { data: directCompletions } = await supabase
            .from('task_completions')
            .select('task_id, completed_by, completed_at')
            .in('task_id', linkedTaskIds);
          
          // Get task due dates to map completions to dates
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
        
        setCompletionsByMember(result);
        setAllCompletedDates(allDates.sort());
      } catch (err) {
        console.error('Error fetching consistency completions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletions();
  }, [goal?.id, goal?.goal_type, goal?.start_date, goal?.end_date, goal?.linked_tasks]);

  return { completionsByMember, allCompletedDates, loading };
}
