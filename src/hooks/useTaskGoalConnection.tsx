import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GoalConnection {
  goalId: string;
  goalTitle: string;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
}

export function useTaskGoalConnections(taskId: string | null, seriesId?: string | null, rotatingTaskId?: string | null) {
  return useQuery({
    queryKey: ['task-goal-connections', taskId, seriesId, rotatingTaskId],
    queryFn: async (): Promise<GoalConnection[]> => {
      // Build the query conditions
      const conditions: string[] = [];
      
      if (taskId && !taskId.startsWith('series-') && !taskId.startsWith('rotating-') && !taskId.startsWith('virtual-')) {
        conditions.push(`task_id.eq.${taskId}`);
      }
      
      let effectiveSeriesId = seriesId;
      
      // If no series_id provided but we have a valid task_id, look up via materialized_task_instances
      if (!effectiveSeriesId && taskId && !taskId.startsWith('series-') && !taskId.startsWith('rotating-') && !taskId.startsWith('virtual-') && taskId.length === 36) {
        const { data: instance } = await supabase
          .from('materialized_task_instances')
          .select('series_id')
          .eq('materialized_task_id', taskId)
          .limit(1)
          .maybeSingle();
        
        if (instance?.series_id) {
          effectiveSeriesId = instance.series_id;
        }
      }
      
      if (effectiveSeriesId) {
        conditions.push(`task_series_id.eq.${effectiveSeriesId}`);
      }
      if (rotatingTaskId) {
        conditions.push(`rotating_task_id.eq.${rotatingTaskId}`);
      }
      
      if (conditions.length === 0) return [];
      
      // Query for all linked goals
      const { data, error } = await supabase
        .from('goal_linked_tasks')
        .select(`
          goal_id,
          milestone_id,
          goal:goals!goal_linked_tasks_goal_id_fkey(id, title),
          milestone:goal_milestones!goal_linked_tasks_milestone_id_fkey(id, title)
        `)
        .or(conditions.join(','));
      
      if (error || !data) return [];
      
      return data.map(item => ({
        goalId: item.goal_id,
        goalTitle: (item.goal as any)?.title || 'Unknown Goal',
        milestoneId: item.milestone_id,
        milestoneTitle: (item.milestone as any)?.title || null,
      }));
    },
    enabled: Boolean(taskId || seriesId || rotatingTaskId),
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Backwards compatible single connection hook
export function useTaskGoalConnection(taskId: string | null, seriesId?: string | null, rotatingTaskId?: string | null) {
  const { data: connections, ...rest } = useTaskGoalConnections(taskId, seriesId, rotatingTaskId);
  
  return {
    ...rest,
    data: connections && connections.length > 0 ? connections[0] : null,
  };
}
