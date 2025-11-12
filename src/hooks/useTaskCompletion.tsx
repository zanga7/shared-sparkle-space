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
      const { error: insertError } = await supabase.rpc('complete_task_for_member', {
        p_task_id: task.id,
        p_completed_by: completerId,
      });

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

      // If this was a rotating task, trigger generation of next instance
      try {
        const rotatingTaskId = (task as any).rotating_task_id as string | undefined;
        if (rotatingTaskId) {
          console.log('🔄 Triggering next rotating task generation for:', rotatingTaskId);
          
          // Call the edge function to generate the next task
          const { data, error } = await supabase.functions.invoke('generate-rotating-tasks', {
            body: { rotating_task_id: rotatingTaskId }
          });

          if (error) {
            console.error('Error generating next rotating task:', error);
          } else {
            console.log('✅ Next rotating task generated:', data);
          }
        }
      } catch (e) {
        console.warn('Rotating-task generation failed (non-fatal):', e);
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
