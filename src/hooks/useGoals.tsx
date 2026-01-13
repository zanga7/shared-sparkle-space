import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { 
  Goal, 
  GoalMilestone, 
  GoalLinkedTask, 
  GoalProgress, 
  CreateGoalData, 
  UpdateGoalData,
  GoalStatus,
  SuccessCriteria
} from '@/types/goal';
import type { Json } from '@/integrations/supabase/types';

export function useGoals() {
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

      // Fetch milestones for all goals
      const goalIds = (goalsData || []).map(g => g.id);
      
      let milestonesMap: Record<string, GoalMilestone[]> = {};
      let linkedTasksMap: Record<string, GoalLinkedTask[]> = {};
      
      if (goalIds.length > 0) {
        const { data: milestonesData } = await supabase
          .from('goal_milestones')
          .select('*, reward:rewards(id, title, image_url)')
          .in('goal_id', goalIds)
          .order('milestone_order', { ascending: true });
        
        milestonesData?.forEach(m => {
          if (!milestonesMap[m.goal_id]) milestonesMap[m.goal_id] = [];
          milestonesMap[m.goal_id].push(m as unknown as GoalMilestone);
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

      // Calculate progress for each goal
      const goalsWithProgress = await Promise.all(
        (goalsData || []).map(async (goal) => {
          const { data: progressData } = await supabase
            .rpc('calculate_goal_progress', { p_goal_id: goal.id });
          
          return {
            ...goal,
            success_criteria: goal.success_criteria as unknown as SuccessCriteria,
            milestones: milestonesMap[goal.id] || [],
            linked_tasks: linkedTasksMap[goal.id] || [],
            progress: progressData as unknown as GoalProgress
          } as Goal;
        })
      );

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

      toast({ title: 'Success', description: 'Goal updated' });
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

  const deleteGoal = async (goalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Goal deleted' });
      await fetchGoals();
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

  // Filter helpers
  const getMyGoals = useCallback((id: string) => {
    return goals.filter(g => 
      g.goal_scope === 'individual' && g.assigned_to === id
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

  useEffect(() => {
    if (familyId) {
      fetchGoals();
    }
  }, [familyId, fetchGoals]);

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
    getMyGoals,
    getFamilyGoals,
    getActiveGoals,
    getGoalById
  };
}