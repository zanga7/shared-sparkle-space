import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Goal } from '@/types/goal';

interface UseTargetCompletionsResult {
  completionsByMember: Record<string, number>;
  totalCompletions: number;
  loading: boolean;
}

export function useTargetCompletions(goal: Goal | null): UseTargetCompletionsResult {
  const [completionsByMember, setCompletionsByMember] = useState<Record<string, number>>({});
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Listen for task-updated events to re-fetch completions
  useEffect(() => {
    const handler = () => setRefreshCounter(c => c + 1);
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, []);

  useEffect(() => {
    if (!goal || goal.goal_type !== 'target_count') {
      setCompletionsByMember({});
      setTotalCompletions(0);
      return;
    }

    const fetchCompletions = async () => {
      setLoading(true);

      try {
        const linkedSeries = goal.linked_tasks?.filter((lt) => lt.task_series_id) || [];
        const linkedTaskIds = goal.linked_tasks?.filter((lt) => lt.task_id).map((lt) => lt.task_id!) || [];

        const result: Record<string, number> = {};
        let total = 0;

        // Fetch completions from task series
        for (const link of linkedSeries) {
          if (!link.task_series_id) continue;

          const { data: instances } = await supabase
            .from('materialized_task_instances')
            .select('materialized_task_id')
            .eq('series_id', link.task_series_id);

          if (!instances || instances.length === 0) continue;

          const taskIds = instances
            .map((i) => i.materialized_task_id)
            .filter(Boolean) as string[];

          if (taskIds.length === 0) continue;

          const { data: completions } = await supabase
            .from('task_completions')
            .select('completed_by')
            .in('task_id', taskIds);

          (completions || []).forEach((c) => {
            result[c.completed_by] = (result[c.completed_by] || 0) + 1;
            total++;
          });
        }

        // Fetch completions from directly linked tasks
        if (linkedTaskIds.length > 0) {
          const { data: directCompletions } = await supabase
            .from('task_completions')
            .select('completed_by')
            .in('task_id', linkedTaskIds);

          (directCompletions || []).forEach((c) => {
            result[c.completed_by] = (result[c.completed_by] || 0) + 1;
            total++;
          });
        }

        setCompletionsByMember(result);
        setTotalCompletions(total);
      } catch (err) {
        console.error('Error fetching target completions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletions();
  }, [goal?.id, goal?.goal_type, goal?.linked_tasks, refreshCounter]);

  return { completionsByMember, totalCompletions, loading };
}
