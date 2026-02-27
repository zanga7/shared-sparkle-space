import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TASK_SELECT_SHAPE } from '@/utils/taskQueryBuilder';
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
  
  // Extract all task IDs, series IDs, and rotating task IDs (stable + deduped for query keys)
  const taskIds = useMemo(() => 
    Array.from(new Set(linkedTasks.filter(lt => lt.task_id).map(lt => lt.task_id!))).sort(),
    [linkedTasks]
  );
  
  const seriesIds = useMemo(() => 
    Array.from(new Set(linkedTasks.filter(lt => lt.task_series_id).map(lt => lt.task_series_id!))).sort(),
    [linkedTasks]
  );
  
  const rotatingIds = useMemo(() => 
    Array.from(new Set(linkedTasks.filter(lt => lt.rotating_task_id).map(lt => lt.rotating_task_id!))).sort(),
    [linkedTasks]
  );
  
  // Refetch function to invalidate all related queries
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['goal-linked-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-series'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-rotating'] });
    queryClient.invalidateQueries({ queryKey: ['consistency-completions'] });
    queryClient.invalidateQueries({ queryKey: ['target-completions'] });
  }, [queryClient]);

  // Listen for task-updated events to refetch stale data (debounced)
  // Only register if this hook instance has actual linked tasks to avoid duplicate listeners
  const hasLinkedTasks = linkedTasks.length > 0;
  useEffect(() => {
    if (!hasLinkedTasks) return;
    
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refetch();
      }, 300);
    };
    window.addEventListener('task-updated', handler);
    return () => {
      window.removeEventListener('task-updated', handler);
      if (timer) clearTimeout(timer);
    };
  }, [refetch, hasLinkedTasks]);

  // Fetch regular tasks
  const { data: regularTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['goal-linked-tasks', taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT_SHAPE)
        .in('id', taskIds) as { data: any[], error: any };
      
      if (error) throw error;
      return data || [];
    },
    enabled: taskIds.length > 0,
  });

  // Fetch task series - get today's materialized instance if available
  // For multi-member consistency goals, we need one task per member
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
      
      // Determine effective occurrence date per series: max(today, series_start)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Build a map of series_id -> effective date (respecting series_start)
      const effectiveDates: Record<string, string> = {};
      (seriesData || []).forEach(series => {
        const seriesStart = series.series_start ? series.series_start.split('T')[0] : today;
        effectiveDates[series.id] = seriesStart > today ? seriesStart : today;
      });
      
      // Try to find materialized instances for effective dates
      // Query for all possible dates we might need
      const uniqueDates = [...new Set(Object.values(effectiveDates))];
      const { data: todayInstances } = await supabase
        .from('materialized_task_instances')
        .select('series_id, materialized_task_id, occurrence_date')
        .in('series_id', seriesIds)
        .in('occurrence_date', uniqueDates);
      
      // Create map of series_id -> task_id for effective date
      const todayTaskIds: Record<string, string> = {};
      todayInstances?.forEach(inst => {
        if (inst.materialized_task_id && inst.occurrence_date === effectiveDates[inst.series_id]) {
          todayTaskIds[inst.series_id] = inst.materialized_task_id;
        }
      });
      
      // Fetch today's actual tasks with completions if they exist
      const taskIdsToFetch = Object.values(todayTaskIds);
      let todayTasksMap: Record<string, any> = {};
      
      if (taskIdsToFetch.length > 0) {
        const { data: todayTasks } = await supabase
          .from('tasks')
          .select(TASK_SELECT_SHAPE)
          .in('id', taskIdsToFetch) as { data: any[], error: any };
        
        todayTasks?.forEach(task => {
          todayTasksMap[task.id] = task;
        });
      }
      
      // Build tasks - for multi-assignee tasks, create one task per member
      const result: Task[] = [];
      
      for (const series of (seriesData || [])) {
        const effectiveDate = effectiveDates[series.id];
        const todayTaskId = todayTaskIds[series.id];
        const todayTask = todayTaskId ? todayTasksMap[todayTaskId] : null;
        const assignedProfiles = series.assigned_profiles || [];

        // If series metadata is newer than today's materialized task row,
        // prefer series display fields to avoid stale title/points flicker.
        const shouldPreferSeriesDisplay = Boolean(
          todayTask &&
          series.updated_at &&
          todayTask.updated_at &&
          new Date(series.updated_at) > new Date(todayTask.updated_at)
        );

        const effectiveTodayTask = todayTask
          ? {
              ...todayTask,
              ...(shouldPreferSeriesDisplay
                ? {
                    title: series.title,
                    description: series.description,
                    points: series.points,
                    task_group: series.task_group,
                    completion_rule: series.completion_rule || todayTask.completion_rule,
                  }
                : {}),
            }
          : null;
        
        // Build full assignees array for the series
        const fullAssignees = assignedProfiles.map((pid: string) => ({
          id: `series-assignee-${series.id}-${pid}`,
          profile_id: pid,
          assigned_at: series.created_at,
          assigned_by: series.created_by,
          profile: profilesMap[pid] || { id: pid, display_name: 'Unknown', color: '#888' },
        }));
        
        // For "everyone" completion rule or multi-assignee, create one task per member
        const isEveryoneRule = series.completion_rule === 'everyone';
        const hasMultipleAssignees = assignedProfiles.length > 1;
        
        if (hasMultipleAssignees && isEveryoneRule) {
          // Create a separate task for each assignee
          for (const profileId of assignedProfiles) {
            const profile = profilesMap[profileId];
            const singleAssignee = [{
              id: `series-assignee-${series.id}-${profileId}`,
              profile_id: profileId,
              assigned_at: series.created_at,
              assigned_by: series.created_by,
              profile: profile || { id: profileId, display_name: 'Unknown', color: '#888' },
            }];
            
            if (effectiveTodayTask) {
              // Filter completions for this specific member
              const memberCompletions = (effectiveTodayTask.task_completions || []).filter(
                (c: any) => c.completed_by === profileId
              );
              
              result.push({
                ...effectiveTodayTask,
                id: `${effectiveTodayTask.id}-${profileId}`, // Unique ID per member
                series_id: series.id,
                occurrence_date: effectiveDate,
                assignees: singleAssignee,
                task_completions: memberCompletions,
                _member_id: profileId, // Track which member this is for
              } as unknown as Task);
            } else {
              // Virtual task for this member
              result.push({
                id: `series-${series.id}-${profileId}`,
                title: series.title,
                description: series.description,
                points: series.points,
                due_date: effectiveDate,
                assigned_to: profileId,
                created_by: series.created_by,
                completion_rule: 'everyone',
                task_group: series.task_group,
                recurrence_options: { enabled: true },
                assignees: singleAssignee,
                task_completions: [],
                isVirtual: true,
                series_id: series.id,
                occurrence_date: effectiveDate,
                _member_id: profileId,
              } as unknown as Task);
            }
          }
        } else {
          // Single task for single assignee or "anyone" rule
          if (effectiveTodayTask) {
            result.push({
              ...effectiveTodayTask,
              series_id: series.id,
              occurrence_date: effectiveDate,
              assignees: effectiveTodayTask.assignees?.length > 0 ? effectiveTodayTask.assignees : fullAssignees,
            } as unknown as Task);
          } else {
            result.push({
              id: `series-${series.id}`,
              title: series.title,
              description: series.description,
              points: series.points,
              due_date: effectiveDate,
              assigned_to: null,
              created_by: series.created_by,
              completion_rule: series.completion_rule || 'any_one',
              task_group: series.task_group,
              recurrence_options: { enabled: true },
              assignees: fullAssignees,
              task_completions: [],
              isVirtual: true,
              series_id: series.id,
              occurrence_date: effectiveDate,
              series_assignee_count: assignedProfiles.length,
            } as unknown as Task);
          }
        }
      }
      
      return result;
    },
    enabled: seriesIds.length > 0,
  });

  // Fetch rotating tasks and find today's generated task
  const { data: rotatingTasks, isLoading: loadingRotating } = useQuery({
    queryKey: ['goal-linked-rotating', rotatingIds],
    queryFn: async () => {
      if (rotatingIds.length === 0) return [];
      
      // Get today's tasks that were generated from these rotating tasks
      const _now = new Date();
      const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
      
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT_SHAPE)
        .in('rotating_task_id', rotatingIds)
        .gte('due_date', today)
        .order('due_date', { ascending: true }) as { data: any[], error: any };
      
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
  // For multi-member consistency goals, we use a unique key per member
  const tasksMap = useMemo(() => {
    const map: Record<string, Task> = {};
    
    // Map regular tasks - use filter to find ALL linked tasks for each task (handles multi-goal)
    (regularTasks || []).forEach(task => {
      const matchingLinkedTasks = linkedTasks.filter(lt => lt.task_id === task.id);
      matchingLinkedTasks.forEach(linkedTask => {
        map[linkedTask.id] = task as unknown as Task;
      });
    });
    
    // Map series tasks - for multi-member tasks, create entry for each member
    (seriesTasks || []).forEach(task => {
      const seriesId = task.series_id;
      const memberId = (task as any)._member_id;
      const matchingLinkedTasks = linkedTasks.filter(lt => lt.task_series_id === seriesId);
      
      matchingLinkedTasks.forEach(linkedTask => {
        if (memberId) {
          // Multi-member task: key by linkedTask.id + memberId
          map[`${linkedTask.id}-${memberId}`] = task;
        } else {
          // Single task for series
          map[linkedTask.id] = task;
        }
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
