import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TASK_SELECT_SHAPE, castTasks, buildFamilyTaskQuery } from '@/utils/taskQueryBuilder';
import { useToast } from '@/hooks/use-toast';
import { useTaskSeries } from '@/hooks/useTaskSeries';
import { useTaskRealtime } from '@/hooks/useTaskRealtime';
import { useMidnightTaskCleanup } from '@/hooks/useMidnightTaskCleanup';
import { Task, Profile } from '@/types/task';

interface UseDashboardTaskDataOptions {
  user: { id: string; email?: string } | null;
}

export function useDashboardTaskData({ user }: UseDashboardTaskDataOptions) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materializedCompletionsMap, setMaterializedCompletionsMap] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const ensuredRotationTodayRef = useRef(false);

  // Task series hook for generating virtual recurring task instances
  const {
    taskSeries,
    generateVirtualTaskInstances,
    fetchTaskSeries
  } = useTaskSeries(profile?.family_id || null);

  // Auto-hide completed tasks at midnight
  useMidnightTaskCleanup();

  // ---- Realtime callbacks ----
  const handleRealtimeTaskInserted = useCallback((task: Task) => {
    setTasks(prevTasks => {
      if (prevTasks.some(t => t.id === task.id)) return prevTasks;
      return [...prevTasks, task];
    });
  }, []);

  const handleRealtimeTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [...prev, task];
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...task };
      return copy;
    });
  }, []);

  const handleRealtimeCompletionAdded = useCallback((taskId: string, completion: any) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, task_completions: [...(t.task_completions || []), completion] }
          : t
      )
    );
  }, []);

  const handleRealtimeCompletionRemoved = useCallback((taskId: string, completionId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, task_completions: (t.task_completions || []).filter((c) => c.id !== completionId) }
          : t
      )
    );
  }, []);

  const handleRealtimeCompletionUpdated = useCallback((taskId: string, completion: any) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, task_completions: (t.task_completions || []).map((c) => c.id === completion.id ? completion : c) }
          : t
      )
    );
  }, []);

  const handleRealtimeSeriesChanged = useCallback(async () => {
    await fetchTaskSeries();
    setTasks(prev => [...prev]);
  }, [fetchTaskSeries]);

  useTaskRealtime({
    familyId: profile?.family_id || null,
    onTaskInserted: handleRealtimeTaskInserted,
    onTaskUpdated: handleRealtimeTaskUpdated,
    onCompletionAdded: handleRealtimeCompletionAdded,
    onCompletionRemoved: handleRealtimeCompletionRemoved,
    onCompletionUpdated: handleRealtimeCompletionUpdated,
    onSeriesChanged: handleRealtimeSeriesChanged,
  });

  // Listen for series updates from dialogs
  useEffect(() => {
    const handler = () => {
      fetchTaskSeries();
      setTasks(prev => [...prev]);
    };
    window.addEventListener('series-updated', handler);
    return () => window.removeEventListener('series-updated', handler);
  }, [fetchTaskSeries]);

  // Listen for midnight cleanup events
  useEffect(() => {
    const handleCleanup = () => {
      fetchUserData();
    };
    window.addEventListener('tasks-cleaned-up', handleCleanup);
    return () => window.removeEventListener('tasks-cleaned-up', handleCleanup);
  }, []);

  // Listen for task-updated events (dispatched from Goals page, MemberTasksWidget, etc.)
  useEffect(() => {
    const handleTaskUpdated = () => {
      if (profile?.family_id) {
        refreshTasksOnly();
      }
    };
    window.addEventListener('task-updated', handleTaskUpdated);
    return () => window.removeEventListener('task-updated', handleTaskUpdated);
  }, [profile?.family_id]);

  // Profiles realtime subscription
  const profileUpdateTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!profile?.family_id) return;

    const profilesChannel = supabase
      .channel(`profiles-${profile.family_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `family_id=eq.${profile.family_id}`
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;

          const existingTimeout = profileUpdateTimeoutRef.current.get(updatedProfile.id);
          if (existingTimeout) clearTimeout(existingTimeout);

          const timeout = setTimeout(() => {
            if (updatedProfile.id === profile.id) {
              setProfile(prev => prev ? { ...prev, total_points: updatedProfile.total_points } : null);
            }
            setFamilyMembers(prev =>
              prev.map(member =>
                member.id === updatedProfile.id
                  ? { ...member, total_points: updatedProfile.total_points }
                  : member
              )
            );
            profileUpdateTimeoutRef.current.delete(updatedProfile.id);
          }, 100);

          profileUpdateTimeoutRef.current.set(updatedProfile.id, timeout);
        }
      )
      .subscribe();

    return () => {
      profileUpdateTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      profileUpdateTimeoutRef.current.clear();
      supabase.removeChannel(profilesChannel);
    };
  }, [profile?.family_id, profile?.id]);

  // ---- Duplicate rotating task cleanup ----
  const cleanupDuplicateRotatingTasksToday = async (familyId: string) => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data: rotating, error: namesError } = await supabase
        .from('rotating_tasks')
        .select('name, allow_multiple_completions')
        .eq('family_id', familyId)
        .eq('is_active', true);

      if (namesError) return;

      const rotatingMap = new Map((rotating || []).map(r => [r.name, r.allow_multiple_completions]));
      const names = Array.from(rotatingMap.keys());
      if (names.length === 0) return;

      const { data: todaysTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, created_at, due_date, task_assignees!inner(profile_id), task_completions(id)')
        .eq('family_id', familyId)
        .is('hidden_at', null)
        .in('title', names)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (tasksError) return;

      type Row = { id: string; title: string; created_at: string; due_date: string | null; task_assignees: { profile_id: string }[]; task_completions?: { id: string }[] };
      const rows = (todaysTasks as unknown as Row[]) || [];
      const toDelete: string[] = [];

      const byTitle = new Map<string, Row[]>();
      const byTitleAndAssignee = new Map<string, Row[]>();

      for (const row of rows) {
        const allowMultiple = rotatingMap.get(row.title);
        if (allowMultiple === false) {
          if (!byTitle.has(row.title)) byTitle.set(row.title, []);
          byTitle.get(row.title)!.push(row);
        } else {
          const assigneeId = row.task_assignees?.[0]?.profile_id || 'unassigned';
          const key = `${row.title}::${assigneeId}`;
          if (!byTitleAndAssignee.has(key)) byTitleAndAssignee.set(key, []);
          byTitleAndAssignee.get(key)!.push(row);
        }
      }

      const pickKeep = (list: Row[]): Row => {
        const isIncomplete = (r: Row) => !r.task_completions || r.task_completions.length === 0;
        const incomplete = list.filter(isIncomplete);
        const source = incomplete.length > 0 ? incomplete : list;
        return source.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      };

      for (const [, list] of byTitle) {
        if (list.length <= 1) continue;
        const keep = pickKeep(list);
        for (const r of list) { if (r.id !== keep.id) toDelete.push(r.id); }
      }

      for (const [, list] of byTitleAndAssignee) {
        if (list.length <= 1) continue;
        const keep = pickKeep(list);
        for (const r of list) { if (r.id !== keep.id) toDelete.push(r.id); }
      }

      if (toDelete.length > 0) {
        await supabase
          .from('tasks')
          .update({ hidden_at: new Date().toISOString() })
          .in('id', toDelete);
      }
    } catch (e) {
      console.error('Error during duplicate cleanup:', e);
    }
  };

  // ---- Fetch user data ----
  const fetchUserData = async () => {
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileErr) {
        console.error('Profile error:', profileErr);
        if (profileErr.code === 'PGRST116') {
          const { data: createResult, error: createError } = await supabase.rpc('fix_my_missing_profile');
          if (createError) {
            setProfileError('Failed to create profile. Please try signing out and back in.');
            return;
          }
          if (createResult && typeof createResult === 'object' && 'success' in createResult && createResult.success) {
            const { data: retryProfileData, error: retryError } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', user?.id)
              .single();
            if (retryError) {
              setProfileError('Profile creation succeeded but fetch failed. Please refresh the page.');
              return;
            }
            setProfile(retryProfileData);
            const { data: membersData } = await supabase
              .from('profiles')
              .select('*')
              .eq('family_id', retryProfileData.family_id)
              .eq('status', 'active')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true });
            setFamilyMembers(membersData || []);
            await cleanupDuplicateRotatingTasksToday(retryProfileData.family_id);

            const { data: tasksData } = await supabase
              .from('tasks')
              .select(TASK_SELECT_SHAPE)
              .eq('family_id', retryProfileData.family_id) as { data: any[]; error: any };
            setTasks(castTasks(tasksData || []));
            await fetchMaterializedCompletions();
            setLoading(false);
            return;
          } else {
            setProfileError('Failed to create missing profile. Please contact support.');
            return;
          }
        } else {
          setProfileError('Failed to load profile. Please try refreshing the page.');
          return;
        }
      }

      setProfile(profileData);

      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      setFamilyMembers(membersData || []);

      if (!ensuredRotationTodayRef.current) {
        ensuredRotationTodayRef.current = true;
        try {
          await supabase.functions.invoke('generate-rotating-tasks', {
            body: { family_id: profileData.family_id }
          });
        } catch {
          ensuredRotationTodayRef.current = false;
        }
      }

      const { data: tasksData, error: tasksError } = await buildFamilyTaskQuery(profileData.family_id) as { data: any[]; error: any };
      if (!tasksError) setTasks(castTasks(tasksData || []));

      await fetchMaterializedCompletions();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterializedCompletions = async () => {
    const { data: materializedData, error } = await supabase
      .from('materialized_task_instances')
      .select(`
        series_id,
        occurrence_date,
        materialized_task_id,
        materialized_task:tasks!materialized_task_instances_materialized_task_id_fkey(
          id,
          task_completions(id, completed_at, completed_by)
        )
      `);

    if (!error && materializedData) {
      const newMap = new Map<string, any[]>();
      materializedData.forEach((instance: any) => {
        if (instance.materialized_task?.task_completions) {
          const key = `${instance.series_id}-${instance.occurrence_date}`;
          newMap.set(key, instance.materialized_task.task_completions);
        }
      });
      setMaterializedCompletionsMap(newMap);
    }
  };

  const refreshTasksOnly = async () => {
    if (!profile?.family_id) return;

    try {
      const { data: tasksData, error: tasksError } = await buildFamilyTaskQuery(profile.family_id) as { data: any[]; error: any };
      if (!tasksError && tasksData) setTasks(castTasks(tasksData));

      const seriesIds = (taskSeries || []).map(s => s.id).filter(Boolean);
      let materializedQuery = supabase
        .from('materialized_task_instances')
        .select(`
          id, series_id, occurrence_date,
          materialized_task:tasks!materialized_task_instances_materialized_task_id_fkey(
            id, task_completions(id, completed_at, completed_by)
          )
        `);
      if (seriesIds.length > 0) materializedQuery = materializedQuery.in('series_id', seriesIds);

      const { data: materializedData, error: materializedError } = await materializedQuery;
      if (!materializedError && materializedData) {
        const newMap = new Map<string, any[]>();
        materializedData.forEach((instance: any) => {
          if (instance.materialized_task?.task_completions) {
            const key = `${instance.series_id}-${instance.occurrence_date}`;
            newMap.set(key, instance.materialized_task.task_completions);
          }
        });
        setMaterializedCompletionsMap(newMap);
      }

      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (updatedProfile) setProfile(updatedProfile);

      const { data: updatedMembers } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (updatedMembers) setFamilyMembers(updatedMembers);

      await fetchTaskSeries();
    } catch (error) {
      console.error('Error in refreshTasksOnly:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user && !profile && !hasFetchedRef.current && !isFetchingRef.current) {
      hasFetchedRef.current = true;
      isFetchingRef.current = true;
      fetchUserData().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [user]);

  // ---- allTasks memo (regular + virtual recurring instances) ----
  const allTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const allVirtualInstances = generateVirtualTaskInstances(today, endOfWeek);

    const seriesInstanceMap = new Map<string, typeof allVirtualInstances[0]>();
    allVirtualInstances.forEach(instance => {
      const instanceKey = `${instance.series_id}-${instance.assigned_profiles.join('-')}`;
      const existing = seriesInstanceMap.get(instanceKey);
      if (!existing || new Date(instance.occurrence_date) < new Date(existing.occurrence_date)) {
        seriesInstanceMap.set(instanceKey, instance);
      }
    });

    const virtualInstances = Array.from(seriesInstanceMap.values());

    const virtualTasks: Task[] = virtualInstances.map(vTask => {
      const completionKey = `${vTask.series_id}-${vTask.occurrence_date}`;
      const completions = materializedCompletionsMap.get(completionKey) || [];

      return {
        id: vTask.id,
        title: vTask.title,
        description: vTask.description || null,
        points: vTask.points,
        due_date: vTask.due_date,
        assigned_to: vTask.assigned_profiles[0] || null,
        created_by: vTask.created_by,
        completion_rule: (vTask.completion_rule || 'everyone') as 'any_one' | 'everyone',
        task_group: vTask.task_group,
        recurrence_options: vTask.recurrence_options,
        series_assignee_count: (vTask as any).series_assignee_count,
        assignees: vTask.assigned_profiles.map(profileId => {
          const memberProfile = familyMembers.find(m => m.id === profileId);
          return {
            id: `${vTask.id}-${profileId}`,
            profile_id: profileId,
            assigned_at: new Date().toISOString(),
            assigned_by: vTask.created_by,
            profile: memberProfile ? {
              id: memberProfile.id,
              display_name: memberProfile.display_name,
              role: memberProfile.role,
              color: memberProfile.color,
              avatar_url: memberProfile.avatar_url || null
            } : {
              id: profileId,
              display_name: 'Unknown',
              role: 'child' as const,
              color: 'gray',
              avatar_url: null
            }
          };
        }),
        task_completions: completions,
        isVirtual: true,
        series_id: vTask.series_id,
        occurrence_date: vTask.occurrence_date,
        isException: vTask.isException,
        exceptionType: vTask.exceptionType,
        task_source: 'series'
      };
    });

    const regularTasks = tasks.filter(t => t.task_source !== 'recurring');
    return [...regularTasks, ...virtualTasks];
  }, [tasks, familyMembers, generateVirtualTaskInstances, materializedCompletionsMap]);

  // Helper: check if a task is completed for a specific member
  const isTaskCompletedForMember = useCallback((task: Task, memberId: string): boolean => {
    const completions = task.task_completions || [];
    if (completions.length === 0) return false;
    if (task.completion_rule === 'everyone') {
      return completions.some((c) => c.completed_by === memberId);
    }
    return true;
  }, []);

  // Get tasks organized by family member
  const getTasksByMember = useCallback((selectedMemberFilter: string | null) => {
    const tasksByMember = new Map<string, Task[]>();
    familyMembers.forEach(member => tasksByMember.set(member.id, []));
    tasksByMember.set('unassigned', []);

    allTasks.forEach(task => {
      if (task.assignees && task.assignees.length > 0) {
        task.assignees.forEach(assignee => {
          const memberTasks = tasksByMember.get(assignee.profile_id) || [];
          if (!memberTasks.some(t => t.id === task.id)) {
            memberTasks.push(task);
            tasksByMember.set(assignee.profile_id, memberTasks);
          }
        });
      } else if (task.assigned_to) {
        const memberTasks = tasksByMember.get(task.assigned_to) || [];
        if (!memberTasks.some(t => t.id === task.id)) {
          memberTasks.push(task);
          tasksByMember.set(task.assigned_to, memberTasks);
        }
      } else {
        const unassigned = tasksByMember.get('unassigned') || [];
        if (!unassigned.some(t => t.id === task.id)) {
          unassigned.push(task);
          tasksByMember.set('unassigned', unassigned);
        }
      }
    });

    if (selectedMemberFilter) {
      const filteredMap = new Map<string, Task[]>();
      filteredMap.set(selectedMemberFilter, tasksByMember.get(selectedMemberFilter) || []);
      return filteredMap;
    }

    return tasksByMember;
  }, [allTasks, familyMembers]);

  return {
    profile,
    setProfile,
    familyMembers,
    setFamilyMembers,
    tasks,
    setTasks,
    allTasks,
    loading,
    profileError,
    fetchUserData,
    refreshTasksOnly,
    fetchTaskSeries,
    isTaskCompletedForMember,
    getTasksByMember,
  };
}
