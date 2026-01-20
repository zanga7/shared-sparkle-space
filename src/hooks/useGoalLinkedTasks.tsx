import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GoalLinkedTask } from '@/types/goal';
import type { Task, Profile } from '@/types/task';

interface GoalLinkedTasksResult {
  tasksMap: Record<string, Task>;
  familyMembers: Profile[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch full task data for goal linked tasks.
 * This allows us to use EnhancedTaskItem instead of GoalTaskItem.
 */
export function useGoalLinkedTasks(linkedTasks: GoalLinkedTask[]): GoalLinkedTasksResult {
  const queryClient = useQueryClient();
  
  // Extract all task IDs, series IDs, and rotating task IDs
  const taskIds = useMemo(() => 
    linkedTasks.filter(lt => lt.task_id).map(lt => lt.task_id!),
    [linkedTasks]
  );
  
  const seriesIds = useMemo(() => 
    linkedTasks.filter(lt => lt.task_series_id).map(lt => lt.task_series_id!),
    [linkedTasks]
  );
  
  const rotatingIds = useMemo(() => 
    linkedTasks.filter(lt => lt.rotating_task_id).map(lt => lt.rotating_task_id!),
    [linkedTasks]
  );
  
  // Refetch function to invalidate all related queries
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['goal-linked-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-series'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-rotating'] });
  }, [queryClient]);

  // Fetch regular tasks
  const { data: regularTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['goal-linked-tasks', taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignees:task_assignees(
            id,
            profile_id,
            assigned_at,
            assigned_by,
            profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color, avatar_url)
          ),
          task_completions(id, completed_at, completed_by)
        `)
        .in('id', taskIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: taskIds.length > 0,
  });

  // Fetch task series - get today's materialized instance if available
  const { data: seriesTasks, isLoading: loadingSeries } = useQuery({
    queryKey: ['goal-linked-series', seriesIds],
    queryFn: async () => {
      if (seriesIds.length === 0) return [];
      
      // First get the series data - note: assigned_profiles is an array column, not a relation
      const { data: seriesData, error: seriesError } = await supabase
        .from('task_series')
        .select('*')
        .in('id', seriesIds);
      
      if (seriesError) throw seriesError;
      
      // Collect all profile IDs from assigned_profiles arrays
      const allProfileIds = new Set<string>();
      (seriesData || []).forEach(series => {
        (series.assigned_profiles || []).forEach((pid: string) => allProfileIds.add(pid));
      });
      
      // Fetch profile data for all assignees
      const profilesMap: Record<string, any> = {};
      if (allProfileIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, role, color, avatar_url')
          .in('id', Array.from(allProfileIds));
        
        (profiles || []).forEach(p => {
          profilesMap[p.id] = p;
        });
      }
      
      // Try to find today's materialized instances for these series
      const today = new Date().toISOString().split('T')[0];
      const { data: todayInstances } = await supabase
        .from('materialized_task_instances')
        .select('series_id, materialized_task_id')
        .in('series_id', seriesIds)
        .eq('occurrence_date', today);
      
      // Create map of series_id -> today's task_id
      const todayTaskIds: Record<string, string> = {};
      todayInstances?.forEach(inst => {
        if (inst.materialized_task_id) {
          todayTaskIds[inst.series_id] = inst.materialized_task_id;
        }
      });
      
      // Fetch today's actual tasks with completions if they exist
      const taskIdsToFetch = Object.values(todayTaskIds);
      let todayTasksMap: Record<string, any> = {};
      
      if (taskIdsToFetch.length > 0) {
        const { data: todayTasks } = await supabase
          .from('tasks')
          .select(`
            *,
            assignees:task_assignees(
              id,
              profile_id,
              assigned_at,
              assigned_by,
              profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color, avatar_url)
            ),
            task_completions(id, completed_at, completed_by)
          `)
          .in('id', taskIdsToFetch);
        
        todayTasks?.forEach(task => {
          todayTasksMap[task.id] = task;
        });
      }
      
      // Return either today's actual task or a virtual task
      return (seriesData || []).map(series => {
        const todayTaskId = todayTaskIds[series.id];
        const todayTask = todayTaskId ? todayTasksMap[todayTaskId] : null;
        
        // Build assignees array from assigned_profiles
        const assignees = (series.assigned_profiles || []).map((pid: string) => ({
          id: `series-assignee-${series.id}-${pid}`,
          profile_id: pid,
          assigned_at: series.created_at,
          assigned_by: series.created_by,
          profile: profilesMap[pid] || { id: pid, display_name: 'Unknown', color: '#888' },
        }));
        
        if (todayTask) {
          // Return today's actual task with completion status
          return {
            ...todayTask,
            series_id: series.id,
            // If today's task doesn't have assignees, use series assignees
            assignees: todayTask.assignees?.length > 0 ? todayTask.assignees : assignees,
          } as unknown as Task;
        }
        
        // Fallback to virtual task
        return {
          id: `series-${series.id}`,
          title: series.title,
          description: series.description,
          points: series.points,
          due_date: today,
          assigned_to: null,
          created_by: series.created_by,
          completion_rule: series.completion_rule || 'any_one',
          task_group: series.task_group,
          recurrence_options: { enabled: true },
          assignees: assignees,
          task_completions: [],
          isVirtual: true,
          series_id: series.id,
          series_assignee_count: series.assigned_profiles?.length || 0,
        } as unknown as Task;
      });
    },
    enabled: seriesIds.length > 0,
  });

  // Fetch rotating tasks and find today's generated task
  const { data: rotatingTasks, isLoading: loadingRotating } = useQuery({
    queryKey: ['goal-linked-rotating', rotatingIds],
    queryFn: async () => {
      if (rotatingIds.length === 0) return [];
      
      // Get today's tasks that were generated from these rotating tasks
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignees:task_assignees(
            id,
            profile_id,
            assigned_at,
            assigned_by,
            profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color, avatar_url)
          ),
          task_completions(id, completed_at, completed_by)
        `)
        .in('rotating_task_id', rotatingIds)
        .gte('due_date', today)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      
      // Group by rotating_task_id and take the first (most relevant) task
      const tasksByRotating: Record<string, Task> = {};
      (data || []).forEach(task => {
        if (task.rotating_task_id && !tasksByRotating[task.rotating_task_id]) {
          tasksByRotating[task.rotating_task_id] = task as unknown as Task;
        }
      });
      
      // For any rotating tasks without a generated task, fetch the rotating task info
      const missingRotatingIds = rotatingIds.filter(id => !tasksByRotating[id]);
      
      if (missingRotatingIds.length > 0) {
        const { data: rotatingData } = await supabase
          .from('rotating_tasks')
          .select('*')
          .in('id', missingRotatingIds);
        
        (rotatingData || []).forEach(rt => {
          // Create a placeholder task
          tasksByRotating[rt.id] = {
            id: `rotating-${rt.id}`,
            title: rt.name,
            description: rt.description,
            points: rt.points,
            due_date: null,
            assigned_to: null,
            created_by: rt.created_by,
            completion_rule: 'any_one',
            task_group: rt.task_group,
            assignees: [],
            task_completions: [],
            rotating_task_id: rt.id,
          } as unknown as Task;
        });
      }
      
      return Object.values(tasksByRotating);
    },
    enabled: rotatingIds.length > 0,
  });

  // Fetch family members for display
  const { data: familyMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ['goal-family-members'],
    queryFn: async () => {
      // Get family_id from the first available source
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .limit(1)
        .single();
      
      if (!profile?.family_id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  // Build tasks map keyed by linked task ID
  const tasksMap = useMemo(() => {
    const map: Record<string, Task> = {};
    
    // Map regular tasks - use filter to find ALL linked tasks for each task (handles multi-goal)
    (regularTasks || []).forEach(task => {
      const matchingLinkedTasks = linkedTasks.filter(lt => lt.task_id === task.id);
      matchingLinkedTasks.forEach(linkedTask => {
        map[linkedTask.id] = task as unknown as Task;
      });
    });
    
    // Map series tasks - use filter for all matching linked tasks
    (seriesTasks || []).forEach(task => {
      const seriesId = task.series_id;
      const matchingLinkedTasks = linkedTasks.filter(lt => lt.task_series_id === seriesId);
      matchingLinkedTasks.forEach(linkedTask => {
        map[linkedTask.id] = task;
      });
    });
    
    // Map rotating tasks - use filter for all matching linked tasks
    (rotatingTasks || []).forEach(task => {
      const rotatingId = task.rotating_task_id || (task.id.startsWith('rotating-') ? task.id.replace('rotating-', '') : null);
      const matchingLinkedTasks = linkedTasks.filter(lt => lt.rotating_task_id === rotatingId);
      matchingLinkedTasks.forEach(linkedTask => {
        map[linkedTask.id] = task;
      });
    });
    
    return map;
  }, [linkedTasks, regularTasks, seriesTasks, rotatingTasks]);

  return {
    tasksMap,
    familyMembers: familyMembers || [],
    isLoading: loadingTasks || loadingSeries || loadingRotating || loadingMembers,
    refetch,
  };
}
