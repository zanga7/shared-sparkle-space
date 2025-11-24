import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Task, Profile } from '@/types/task';
import { useDashboardAuth } from './useDashboardAuth';

interface UseTaskCompletionProps {
  currentUserProfile: Profile | null;
  activeMemberId?: string | null;
  isDashboardMode?: boolean;
  setTasks?: React.Dispatch<React.SetStateAction<Task[]>>;
  setProfile?: React.Dispatch<React.SetStateAction<Profile | null>>;
  setFamilyMembers?: React.Dispatch<React.SetStateAction<Profile[]>>;
}

export const useTaskCompletion = ({
  currentUserProfile,
  activeMemberId,
  isDashboardMode = false,
  setTasks,
  setProfile,
  setFamilyMembers,
}: UseTaskCompletionProps) => {
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const { canPerformAction, authenticateMemberPin } = useDashboardAuth();

  const completeTask = async (
    task: Task,
    onSuccess?: () => void
  ): Promise<boolean> => {
    // Prevent double-submissions
    if (completingTasks.has(task.id)) {
      return false;
    }

    setCompletingTasks(prev => new Set(prev).add(task.id));

    try {
      // Determine who is completing the task
      let completerId: string | null = null;

      if (isDashboardMode && activeMemberId) {
        completerId = activeMemberId;
      } else if (task.assignees && task.assignees.length === 1 && !activeMemberId) {
        completerId = task.assignees[0].profile_id;
      } else if (currentUserProfile) {
        completerId = currentUserProfile.id;
      }

      if (!completerId) {
        toast({
          title: "Error",
          description: "Could not determine who is completing this task",
          variant: "destructive",
        });
        return false;
      }

      // Check if PIN is required
      if (isDashboardMode && activeMemberId) {
        const { canProceed } = await canPerformAction(activeMemberId, 'task_completion');
        if (!canProceed) {
          toast({
            title: "PIN Required",
            description: "Please enter your PIN to complete this task",
            variant: "destructive",
          });
          return false;
        }
      }

      // Handle virtual recurring task instances - materialize them first
      let actualTaskId = task.id;
      const isVirtualTask = (task as any).isVirtual === true;
      
      if (isVirtualTask) {
        console.log('Materializing virtual task instance:', task.id);
        
        // Create the actual task from the virtual instance
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            points: task.points,
            due_date: task.due_date,
            task_group: task.task_group,
            completion_rule: task.completion_rule || 'everyone',
            family_id: (task as any).family_id || currentUserProfile?.family_id,
            created_by: (task as any).created_by || currentUserProfile?.id,
            series_id: (task as any).series_id,
          })
          .select()
          .single();

        if (createError || !newTask) {
          console.error('Error materializing virtual task:', createError);
          toast({
            title: "Error",
            description: "Failed to create task instance",
            variant: "destructive",
          });
          return false;
        }

        // Assign to the same profiles
        if (task.assignees && task.assignees.length > 0) {
          const assigneesData = task.assignees.map(assignee => ({
            task_id: newTask.id,
            profile_id: assignee.profile_id,
            assigned_by: currentUserProfile?.id || (task as any).created_by,
          }));

          await supabase.from('task_assignees').insert(assigneesData);
        }

        actualTaskId = newTask.id;
        console.log('Materialized task ID:', actualTaskId);
      }

      // Optimistic UI update - update local state immediately
      const optimisticCompletion = {
        id: crypto.randomUUID(),
        task_id: task.id,
        completed_by: completerId,
        points_earned: task.points,
        completed_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
      };

      if (setTasks) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  task_completions: [...(t.task_completions || []), optimisticCompletion],
                }
              : t
          )
        );
      }

      // Optimistically update points for the completer
      if (setProfile && currentUserProfile?.id === completerId) {
        setProfile((prev) =>
          prev ? { ...prev, total_points: prev.total_points + task.points } : null
        );
      }
      
      if (setFamilyMembers) {
        setFamilyMembers((prev) =>
          prev.map((member) =>
            member.id === completerId
              ? { ...member, total_points: member.total_points + task.points }
              : member
          )
        );
      }

      // Show immediate feedback
      toast({
        title: "Task Completed!",
        description: `+${task.points} points earned`,
      });

      // Call RPC to ensure points are properly handled
      let insertError = null;
      try {
        const { error } = await supabase.rpc('complete_task_for_member', {
          p_task_id: actualTaskId,
          p_completed_by: completerId,
        });
        insertError = error;
      } catch (fetchError: any) {
        console.error('Network error completing task:', fetchError);
        insertError = {
          message: 'Network error. Please check your connection and try again.',
          code: 'FETCH_ERROR'
        };
      }

      if (insertError) {
        console.error('Error completing task:', insertError);
        
        // Rollback optimistic update for tasks
        if (setTasks) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    task_completions: (t.task_completions || []).filter(
                      (c) => c.id !== optimisticCompletion.id
                    ),
                  }
                : t
            )
          );
        }

        // Rollback optimistic points update
        if (setProfile && currentUserProfile?.id === completerId) {
          setProfile((prev) =>
            prev ? { ...prev, total_points: prev.total_points - task.points } : null
          );
        }
        
        if (setFamilyMembers) {
          setFamilyMembers((prev) =>
            prev.map((member) =>
              member.id === completerId
                ? { ...member, total_points: member.total_points - task.points }
                : member
            )
          );
        }
        
        // Check if it's a duplicate completion
        if (insertError.code === '23505') {
          toast({
            title: "Already Completed",
            description: "This task has already been completed",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: insertError.message || "Failed to complete task",
            variant: "destructive",
          });
        }
        return false;
      }

      // If this was a rotating task, trigger generation of next instance and robustly hydrate UI
      try {
        const rotatingTaskId = (task as any).rotating_task_id as string | undefined;
        const familyId = (task as any).family_id || currentUserProfile?.family_id;
        const taskName = task.title;
        const startedAt = new Date();

        if (rotatingTaskId || familyId) {
          console.log('🔄 Triggering rotating task generation for:', { rotatingTaskId, familyId, taskName });
          
          // Call the edge function to generate the next task with timeout
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const { data, error } = await supabase.functions.invoke('generate-rotating-tasks', {
              body: {
                rotating_task_id: rotatingTaskId,
                task_name: taskName,
                family_id: familyId,
                assign_next_member: true,
              },
              headers: {
                'Content-Type': 'application/json',
              },
            });

            clearTimeout(timeoutId);

            if (error) {
              console.error('Error generating next rotating task:', error);
            } else {
              console.log('✅ Rotating task generation response:', data);
            }
          } catch (edgeFunctionError: any) {
            if (edgeFunctionError.name === 'AbortError') {
              console.warn('Rotating task generation timed out (non-fatal)');
            } else {
              console.error('Edge function network error (non-fatal):', edgeFunctionError);
            }
          }

          // Fallback: after a short delay, fetch the most recent uncompleted task for this series
          if (setTasks && familyId) {
            await new Promise((r) => setTimeout(r, 350));
            let query = supabase
              .from('tasks')
              .select(`
                id,
                title,
                description,
                points,
                due_date,
                assigned_to,
                created_by,
                completion_rule,
                task_group,
                family_id,
                rotating_task_id,
                assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
                assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
                task_completions(id, completed_at, completed_by)
              `)
              .eq('family_id', familyId)
              .eq('title', taskName)
              .gte('created_at', startedAt.toISOString())
              .order('created_at', { ascending: false })
              .limit(1);

            if (rotatingTaskId) {
              query = query.eq('rotating_task_id', rotatingTaskId);
            }

            const { data: nextTasks } = await query;
            const nextTask = nextTasks?.[0];
            if (nextTask) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === nextTask.id)) return prev;
                return [
                  ...prev,
                  {
                    ...nextTask,
                    completion_rule: (nextTask.completion_rule || 'everyone') as 'any_one' | 'everyone',
                  },
                ];
              });
            }
          }
        }
      } catch (e) {
        console.warn('Rotating-task generation/fallback failed (non-fatal):', e);
      }

      return true;

    } catch (error) {
      console.error('Error in completeTask:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const uncompleteTask = async (
    task: Task,
    onSuccess?: () => void
  ): Promise<boolean> => {
    // Prevent double-submissions
    if (completingTasks.has(task.id)) {
      return false;
    }

    setCompletingTasks(prev => new Set(prev).add(task.id));

    try {
      // Determine which completion to remove
      let completerId: string | null = null;

      if (isDashboardMode && activeMemberId) {
        completerId = activeMemberId;
      } else if (currentUserProfile) {
        completerId = currentUserProfile.id;
      }

      if (!completerId) {
        toast({
          title: "Error",
          description: "Could not determine which completion to remove",
          variant: "destructive",
        });
        return false;
      }

      // Find the completion record in local state
      const completion = task.task_completions?.find(
        (c) => c.completed_by === completerId
      );

      if (!completion) {
        toast({
          title: "Error",
          description: "No completion found to remove",
          variant: "destructive",
        });
        return false;
      }

      // Optimistic UI update - remove completion immediately
      if (setTasks) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  task_completions: (t.task_completions || []).filter(
                    (c) => c.id !== completion.id
                  ),
                }
              : t
          )
        );
      }

      // Optimistically update points for the completer (subtract)
      if (setProfile && currentUserProfile?.id === completerId) {
        setProfile((prev) =>
          prev ? { ...prev, total_points: prev.total_points - task.points } : null
        );
      }
      
      if (setFamilyMembers) {
        setFamilyMembers((prev) =>
          prev.map((member) =>
            member.id === completerId
              ? { ...member, total_points: member.total_points - task.points }
              : member
          )
        );
      }

      // Show immediate feedback
      toast({
        title: "Task Uncompleted",
        description: `-${task.points} points removed`,
      });

      // Call RPC to ensure points are properly handled
      const { error } = await supabase.rpc('uncomplete_task_for_member', {
        p_completion_id: completion.id,
      });

      if (error) {
        console.error('Error uncompleting task:', error);
        
        // Rollback optimistic update for tasks
        if (setTasks) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    task_completions: [...(t.task_completions || []), completion],
                  }
                : t
            )
          );
        }

        // Rollback optimistic points update (add back)
        if (setProfile && currentUserProfile?.id === completerId) {
          setProfile((prev) =>
            prev ? { ...prev, total_points: prev.total_points + task.points } : null
          );
        }
        
        if (setFamilyMembers) {
          setFamilyMembers((prev) =>
            prev.map((member) =>
              member.id === completerId
                ? { ...member, total_points: member.total_points + task.points }
                : member
            )
          );
        }
        
        toast({
          title: "Error",
          description: error.message || "Failed to uncomplete task",
          variant: "destructive",
        });
        return false;
      }

      // Realtime will handle final state sync with correct data from DB
      return true;

    } catch (error) {
      console.error('Error in uncompleteTask:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  return {
    completeTask,
    uncompleteTask,
    isCompleting: (taskId: string) => completingTasks.has(taskId),
  };
};
