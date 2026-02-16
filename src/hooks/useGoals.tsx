import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type {
  Goal,
  GoalMilestone,
  GoalLinkedTask,
  GoalProgress,
  GoalAssignee,
  CreateGoalData,
  UpdateGoalData,
  GoalStatus,
  SuccessCriteria
} from '@/types/goal';
import type { Json } from '@/integrations/supabase/types';

const GoalsContext = createContext<ReturnType<typeof useGoalsState> | null>(null);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const value = useGoalsState();
  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) {
    throw new Error('useGoals must be used within a GoalsProvider');
  }
  return ctx;
}

function useGoalsState() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch the user's profile to get family_id
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setFamilyId(null);
        setProfileId(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setFamilyId(profile.family_id);
        setProfileId(profile.id);
      }
    };

    fetchProfile();
  }, [user]);

  const fetchGoals = useCallback(async () => {
    if (!familyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch goals with related data
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select(`
          *,
          assignee:profiles!goals_assigned_to_fkey(id, display_name, color, avatar_url),
          creator:profiles!goals_created_by_fkey(id, display_name),
          reward:rewards(id, title, image_url, cost_points)
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Fetch milestones, linked tasks, and assignees for all goals
      const goalIds = (goalsData || []).map(g => g.id);
      
      let milestonesMap: Record<string, GoalMilestone[]> = {};
      let linkedTasksMap: Record<string, GoalLinkedTask[]> = {};
      let assigneesMap: Record<string, GoalAssignee[]> = {};
      
      if (goalIds.length > 0) {
        // Fetch milestones
        const { data: milestonesData } = await supabase
          .from('goal_milestones')
          .select('*, reward:rewards(id, title, image_url)')
          .in('goal_id', goalIds)
          .order('milestone_order', { ascending: true });
        
        milestonesData?.forEach(m => {
          if (!milestonesMap[m.goal_id]) milestonesMap[m.goal_id] = [];
          milestonesMap[m.goal_id].push(m as unknown as GoalMilestone);
        });

        // Fetch assignees - use explicit FK to avoid PGRST201 (multiple FK relationships)
        const { data: assigneesData } = await supabase
          .from('goal_assignees')
          .select(`
            *,
            profile:profiles!goal_assignees_profile_id_fkey(id, display_name, role, color, avatar_url)
          `)
          .in('goal_id', goalIds);
        
        assigneesData?.forEach(a => {
          if (!assigneesMap[a.goal_id]) assigneesMap[a.goal_id] = [];
          assigneesMap[a.goal_id].push(a as unknown as GoalAssignee);
        });

        // Fetch linked tasks
        const { data: linkedTasksData } = await supabase
          .from('goal_linked_tasks')
          .select('*')
          .in('goal_id', goalIds);
        
        // Enrich with task titles
        if (linkedTasksData && linkedTasksData.length > 0) {
          const taskIds = linkedTasksData.filter(lt => lt.task_id).map(lt => lt.task_id);
          const seriesIds = linkedTasksData.filter(lt => lt.task_series_id).map(lt => lt.task_series_id);
          const rotatingIds = linkedTasksData.filter(lt => lt.rotating_task_id).map(lt => lt.rotating_task_id);
          
          let taskTitles: Record<string, string> = {};
          let seriesTitles: Record<string, string> = {};
          let rotatingTitles: Record<string, string> = {};
          
          if (taskIds.length > 0) {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('id, title')
              .in('id', taskIds);
            tasks?.forEach(t => { taskTitles[t.id] = t.title; });
          }
          
          if (seriesIds.length > 0) {
            const { data: series } = await supabase
              .from('task_series')
              .select('id, title')
              .in('id', seriesIds);
            series?.forEach(s => { seriesTitles[s.id] = s.title; });
          }
          
          if (rotatingIds.length > 0) {
            const { data: rotating } = await supabase
              .from('rotating_tasks')
              .select('id, name')
              .in('id', rotatingIds);
            rotating?.forEach(r => { rotatingTitles[r.id] = r.name; });
          }
          
          linkedTasksData.forEach(lt => {
            if (!linkedTasksMap[lt.goal_id]) linkedTasksMap[lt.goal_id] = [];
            linkedTasksMap[lt.goal_id].push({
              ...lt,
              task_title: lt.task_id ? taskTitles[lt.task_id] :
                         lt.task_series_id ? seriesTitles[lt.task_series_id] :
                         lt.rotating_task_id ? rotatingTitles[lt.rotating_task_id] : undefined,
              task_type: lt.task_id ? 'one_off' :
                        lt.task_series_id ? 'recurring' :
                        lt.rotating_task_id ? 'rotating' : undefined
            } as GoalLinkedTask);
          });
        }
      }

      // Calculate progress for all goals in a single batch call (eliminates N+1 pattern)
      let progressMap: Record<string, Partial<GoalProgress>> = {};
      if (goalIds.length > 0) {
        const { data: batchProgressData } = await supabase
          .rpc('calculate_goals_progress_batch', { p_goal_ids: goalIds });
        
        if (batchProgressData) {
          batchProgressData.forEach((p: any) => {
            progressMap[p.goal_id] = {
              goal_id: p.goal_id,
              current_percent: Number(p.percentage) || 0,
              is_complete: Number(p.percentage) >= 100,
              total_completions: p.total_completions,
              expected_completions: p.expected_completions,
              completed_milestones: p.completed_tasks,
              total_milestones: p.total_tasks,
              current_count: Number(p.current_value) || 0,
              target_count: Number(p.target_value) || 1,
            };
          });
        }
      }

      // Build goals with progress data
      const goalsWithProgress = (goalsData || []).map((goal) => ({
        ...goal,
        success_criteria: goal.success_criteria as unknown as SuccessCriteria,
        milestones: milestonesMap[goal.id] || [],
        linked_tasks: linkedTasksMap[goal.id] || [],
        assignees: assigneesMap[goal.id] || [],
        progress: progressMap[goal.id] as GoalProgress | undefined
      } as Goal));

      // Auto-complete goals whose end date has passed
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const goalsToAutoComplete = goalsWithProgress.filter(g => {
        if (g.status !== 'active' && g.status !== 'paused') return false;
        
        let effectiveEndDate: Date | null = null;
        if (g.goal_type === 'consistency' && 'time_window_days' in g.success_criteria) {
          const start = new Date(g.start_date + 'T00:00:00');
          start.setDate(start.getDate() + (g.success_criteria as { time_window_days: number }).time_window_days);
          effectiveEndDate = start;
        } else if (g.end_date) {
          effectiveEndDate = new Date(g.end_date + 'T00:00:00');
        }
        
        return effectiveEndDate && effectiveEndDate < now;
      });

      if (goalsToAutoComplete.length > 0) {
        const idsToComplete = goalsToAutoComplete.map(g => g.id);
        await supabase
          .from('goals')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .in('id', idsToComplete);
        
        // Update local state
        goalsToAutoComplete.forEach(g => { g.status = 'completed'; });
      }

      setGoals(goalsWithProgress);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  const createGoal = async (data: CreateGoalData): Promise<Goal | null> => {
    if (!familyId || !profileId) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      return null;
    }

    try {
      // Create the goal
      const { data: goal, error: goalError } = await supabase
        .from('goals')
        .insert({
          family_id: familyId,
          title: data.title,
          description: data.description,
          goal_type: data.goal_type,
          goal_scope: data.goal_scope,
          assigned_to: data.assigned_to,
          reward_id: data.reward_id,
          success_criteria: data.success_criteria as unknown as Json,
          start_date: data.start_date,
          end_date: data.end_date,
          created_by: profileId
        })
        .select()
        .single();

      if (goalError) throw goalError;

      // Create milestones if provided
      if (data.milestones && data.milestones.length > 0) {
        const milestonesToInsert = data.milestones.map((m, idx) => ({
          goal_id: goal.id,
          title: m.title,
          milestone_order: m.milestone_order ?? idx,
          completion_criteria: m.completion_criteria as unknown as Json,
          reward_id: m.reward_id
        }));

        const { error: milestoneError } = await supabase
          .from('goal_milestones')
          .insert(milestonesToInsert);

        if (milestoneError) console.error('Error creating milestones:', milestoneError);
      }

      // Link tasks if provided
      const taskLinks = [
        ...(data.linked_task_ids || []).map(id => ({ 
          goal_id: goal.id, 
          task_id: id, 
          linked_by: profileId 
        })),
        ...(data.linked_series_ids || []).map(id => ({ 
          goal_id: goal.id, 
          task_series_id: id, 
          linked_by: profileId 
        })),
        ...(data.linked_rotating_ids || []).map(id => ({ 
          goal_id: goal.id, 
          rotating_task_id: id, 
          linked_by: profileId 
        }))
      ];

      if (taskLinks.length > 0) {
        const { error: linkError } = await supabase
          .from('goal_linked_tasks')
          .insert(taskLinks);

        if (linkError) console.error('Error linking tasks:', linkError);
      }

      // Add assignees if provided
      if (data.assignees && data.assignees.length > 0) {
        const assigneesToInsert = data.assignees.map(assigneeProfileId => ({
          goal_id: goal.id,
          profile_id: assigneeProfileId,
          assigned_by: profileId
        }));

        const { error: assigneeError } = await supabase
          .from('goal_assignees')
          .insert(assigneesToInsert);

        if (assigneeError) console.error('Error adding assignees:', assigneeError);
      }

      toast({ title: 'Success', description: 'Goal created successfully' });
      await fetchGoals();
      return {
        ...goal,
        success_criteria: goal.success_criteria as unknown as SuccessCriteria
      } as Goal;
    } catch (err) {
      console.error('Error creating goal:', err);
      toast({ title: 'Error', description: 'Failed to create goal', variant: 'destructive' });
      return null;
    }
  };

  const updateGoal = async (goalId: string, data: UpdateGoalData): Promise<boolean> => {
    if (!profileId) return false;
    
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.reward_id !== undefined) updateData.reward_id = data.reward_id;
      if (data.end_date !== undefined) updateData.end_date = data.end_date;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.success_criteria !== undefined) {
        updateData.success_criteria = data.success_criteria as unknown as Json;
      }

      const { error } = await supabase
        .from('goals')
        .update(updateData)
        .eq('id', goalId);

      if (error) throw error;

      // Update assignees if provided
      if (data.assignees !== undefined) {
        // Delete existing assignees
        await supabase
          .from('goal_assignees')
          .delete()
          .eq('goal_id', goalId);
        
        // Insert new assignees
        if (data.assignees.length > 0) {
          const assigneesToInsert = data.assignees.map(assigneeProfileId => ({
            goal_id: goalId,
            profile_id: assigneeProfileId,
            assigned_by: profileId
          }));

          const { error: assigneeError } = await supabase
            .from('goal_assignees')
            .insert(assigneesToInsert);

          if (assigneeError) console.error('Error updating assignees:', assigneeError);
        }
        
        // Update assigned_to for single assignee
        if (data.assignees.length === 1) {
          await supabase
            .from('goals')
            .update({ assigned_to: data.assignees[0] })
            .eq('id', goalId);
        } else {
          await supabase
            .from('goals')
            .update({ assigned_to: null })
            .eq('id', goalId);
        }
      }

      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error updating goal:', err);
      toast({ title: 'Error', description: 'Failed to update goal', variant: 'destructive' });
      return false;
    }
  };

  const updateGoalStatus = async (goalId: string, status: GoalStatus): Promise<boolean> => {
    return updateGoal(goalId, { status });
  };

  const pauseGoal = (goalId: string) => updateGoalStatus(goalId, 'paused');
  const resumeGoal = (goalId: string) => updateGoalStatus(goalId, 'active');
  const archiveGoal = (goalId: string) => updateGoalStatus(goalId, 'archived');
  const completeGoal = (goalId: string) => updateGoalStatus(goalId, 'completed');

  const deleteGoal = async (goalId: string, deleteLinkedTasks: boolean = false): Promise<boolean> => {
    try {
      // If deleteLinkedTasks is true, delete linked tasks first
      if (deleteLinkedTasks) {
        // Get linked tasks for this goal
        const { data: linkedTasks } = await supabase
          .from('goal_linked_tasks')
          .select('task_id, task_series_id, rotating_task_id')
          .eq('goal_id', goalId);
        
        if (linkedTasks) {
          // Delete regular tasks
          const taskIds = linkedTasks.filter(lt => lt.task_id).map(lt => lt.task_id!);
          if (taskIds.length > 0) {
            await supabase.from('tasks').delete().in('id', taskIds);
          }
          
          // Delete task series
          const seriesIds = linkedTasks.filter(lt => lt.task_series_id).map(lt => lt.task_series_id!);
          if (seriesIds.length > 0) {
            await supabase.from('task_series').delete().in('id', seriesIds);
          }
          
          // Note: We don't delete rotating tasks as they may be shared
        }
      }
      
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      // Immediately update local state for instant UI feedback
      setGoals(prevGoals => prevGoals.filter(g => g.id !== goalId));
      
      toast({ title: 'Success', description: 'Goal deleted' });
      return true;
    } catch (err) {
      console.error('Error deleting goal:', err);
      toast({ title: 'Error', description: 'Failed to delete goal', variant: 'destructive' });
      return false;
    }
  };

  const linkTaskToGoal = async (
    goalId: string, 
    taskRef: { task_id?: string; task_series_id?: string; rotating_task_id?: string }
  ): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error } = await supabase
        .from('goal_linked_tasks')
        .insert({
          goal_id: goalId,
          ...taskRef,
          linked_by: profileId
        });

      if (error) throw error;

      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error linking task:', err);
      toast({ title: 'Error', description: 'Failed to link task', variant: 'destructive' });
      return false;
    }
  };

  const unlinkTaskFromGoal = async (linkId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goal_linked_tasks')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error unlinking task:', err);
      return false;
    }
  };

  const completeMilestone = async (milestoneId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);

      if (error) throw error;

      toast({ title: 'Milestone completed!' });
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error completing milestone:', err);
      return false;
    }
  };

  const uncompleteMilestone = async (milestoneId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .update({
          is_completed: false,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);

      if (error) throw error;

      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error uncompleting milestone:', err);
      return false;
    }
  };

  // Milestone CRUD operations
  const addMilestone = async (goalId: string, title: string, order: number): Promise<string | null> => {
    if (!profileId) return null;
    
    try {
      const { data, error } = await supabase
        .from('goal_milestones')
        .insert({
          goal_id: goalId,
          title,
          milestone_order: order,
          completion_criteria: { type: 'manual' } as unknown as Json
        })
        .select('id')
        .single();
      
      if (error) throw error;
      await fetchGoals();
      return data.id;
    } catch (err) {
      console.error('Error adding milestone:', err);
      toast({ title: 'Error', description: 'Failed to add milestone', variant: 'destructive' });
      return null;
    }
  };

  const updateMilestone = async (milestoneId: string, updates: { title?: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);
      
      if (error) throw error;
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error updating milestone:', err);
      return false;
    }
  };

  const deleteMilestone = async (milestoneId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .delete()
        .eq('id', milestoneId);
      
      if (error) throw error;
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error deleting milestone:', err);
      return false;
    }
  };

  // Link task to specific milestone
  const linkTaskToMilestone = async (
    goalId: string,
    milestoneId: string,
    taskRef: { task_id?: string; task_series_id?: string; rotating_task_id?: string }
  ): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error } = await supabase
        .from('goal_linked_tasks')
        .insert({
          goal_id: goalId,
          milestone_id: milestoneId,
          ...taskRef,
          linked_by: profileId
        });

      if (error) throw error;
      await fetchGoals();
      return true;
    } catch (err) {
      console.error('Error linking task to milestone:', err);
      toast({ title: 'Error', description: 'Failed to link task to milestone', variant: 'destructive' });
      return false;
    }
  };
  const getMyGoals = useCallback((id: string) => {
    return goals.filter(g => 
      g.goal_scope === 'individual' && (
        g.assigned_to === id || 
        g.assignees?.some(a => a.profile_id === id)
      )
    );
  }, [goals]);

  const getFamilyGoals = useCallback(() => {
    return goals.filter(g => g.goal_scope === 'family');
  }, [goals]);

  const getActiveGoals = useCallback(() => {
    return goals.filter(g => g.status === 'active');
  }, [goals]);

  const getGoalById = useCallback((goalId: string) => {
    return goals.find(g => g.id === goalId);
  }, [goals]);

  // Reorder goals (local state only, could persist to DB if needed)
  const reorderGoals = useCallback((goalIds: string[]) => {
    // For now this is just a local reorder - could add sort_order column to DB
    console.log('Goals reordered:', goalIds);
  }, []);

  useEffect(() => {
    if (familyId) {
      fetchGoals();
    }
  }, [familyId, fetchGoals]);

  // Fetch consistency goal completion dates per member
  const fetchConsistencyCompletions = async (
    seriesId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, string[]>> => {
    try {
      // Get materialized task instances for this series
      const { data: instances, error } = await supabase
        .from('materialized_task_instances')
        .select(`
          occurrence_date,
          materialized_task_id
        `)
        .eq('series_id', seriesId)
        .gte('occurrence_date', startDate)
        .lte('occurrence_date', endDate);
      
      if (error) throw error;
      
      // Get task IDs that have materialized instances
      const taskIds = (instances || [])
        .map(i => i.materialized_task_id)
        .filter(Boolean) as string[];
      
      if (taskIds.length === 0) return {};
      
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
      const result: Record<string, string[]> = {};
      (instances || []).forEach(instance => {
        if (!instance.materialized_task_id) return;
        const taskCompletions = completionsByTask[instance.materialized_task_id] || [];
        taskCompletions.forEach(c => {
          if (!result[c.completed_by]) result[c.completed_by] = [];
          if (!result[c.completed_by].includes(instance.occurrence_date)) {
            result[c.completed_by].push(instance.occurrence_date);
          }
        });
      });
      
      return result;
    } catch (err) {
      console.error('Error fetching consistency completions:', err);
      return {};
    }
  };

  return {
    goals,
    loading,
    error,
    profileId,
    familyId,
    fetchGoals,
    createGoal,
    updateGoal,
    updateGoalStatus,
    pauseGoal,
    resumeGoal,
    archiveGoal,
    completeGoal,
    deleteGoal,
    linkTaskToGoal,
    unlinkTaskFromGoal,
    completeMilestone,
    uncompleteMilestone,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    linkTaskToMilestone,
    reorderGoals,
    getMyGoals,
    getFamilyGoals,
    getActiveGoals,
    getGoalById,
    fetchConsistencyCompletions
  };
}