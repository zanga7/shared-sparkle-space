import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Goal } from '@/types/goal';

interface TargetCompletionsData {
  completionsByMember: Record<string, number>;
  totalCompletions: number;
}

interface UseTargetCompletionsResult extends TargetCompletionsData {
  loading: boolean;
}

async function fetchTargetData(goal: Goal): Promise<TargetCompletionsData> {
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

  return { completionsByMember: result, totalCompletions: total };
}

export function useTargetCompletions(goal: Goal | null): UseTargetCompletionsResult {
  const queryClient = useQueryClient();
  const goalId = goal?.id;
  const isTarget = goal?.goal_type === 'target_count';

  // Listen for task-updated events to invalidate this specific query
  useEffect(() => {
    if (!goalId) return;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['target-completions', goalId] });
    };
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [goalId, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['target-completions', goalId],
    queryFn: () => fetchTargetData(goal!),
    enabled: !!goalId && isTarget,
    staleTime: 30_000,
  });

  return {
    completionsByMember: data?.completionsByMember ?? {},
    totalCompletions: data?.totalCompletions ?? 0,
    loading: isLoading,
  };
}
