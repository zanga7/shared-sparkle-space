import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GoalConnection {
  goalId: string;
  goalTitle: string;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
}

export function useTaskGoalConnection(taskId: string | null, seriesId?: string | null, rotatingTaskId?: string | null) {
  return useQuery({
    queryKey: ['task-goal-connection', taskId, seriesId, rotatingTaskId],
    queryFn: async (): Promise<GoalConnection | null> => {
      // Build the query conditions
      const conditions: string[] = [];
      
      if (taskId && !taskId.startsWith('series-') && !taskId.startsWith('rotating-')) {
        conditions.push(`task_id.eq.${taskId}`);
      }
      if (seriesId) {
        conditions.push(`task_series_id.eq.${seriesId}`);
      }
      if (rotatingTaskId) {
        conditions.push(`rotating_task_id.eq.${rotatingTaskId}`);
      }
      
      if (conditions.length === 0) return null;
      
      // Query for any linked goal
      const { data, error } = await supabase
        .from('goal_linked_tasks')
        .select(`
          goal_id,
          milestone_id,
          goal:goals!goal_linked_tasks_goal_id_fkey(id, title),
          milestone:goal_milestones!goal_linked_tasks_milestone_id_fkey(id, title)
        `)
        .or(conditions.join(','))
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      return {
        goalId: data.goal_id,
        goalTitle: (data.goal as any)?.title || 'Unknown Goal',
        milestoneId: data.milestone_id,
        milestoneTitle: (data.milestone as any)?.title || null,
      };
    },
    enabled: Boolean(taskId || seriesId || rotatingTaskId),
    staleTime: 30000, // Cache for 30 seconds
  });
}
