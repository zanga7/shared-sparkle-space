import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Task, Profile } from '@/types/task';
import { useDashboardAuth } from './useDashboardAuth';

interface UseTaskCompletionProps {
  currentUserProfile: Profile | null;
  activeMemberId?: string | null;
  isDashboardMode?: boolean;
}

export const useTaskCompletion = ({
  currentUserProfile,
  activeMemberId,
  isDashboardMode = false,
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
        // Dashboard mode: use active member
        completerId = activeMemberId;
      } else if (task.assignees && task.assignees.length === 1 && !activeMemberId) {
        // Single assignee and no active member selected
        completerId = task.assignees[0].profile_id;
      } else if (currentUserProfile) {
        // Default to current user
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
        const canComplete = await canPerformAction(activeMemberId, 'task_completion');
        if (!canComplete) {
          toast({
            title: "PIN Required",
            description: "Please enter your PIN to complete this task",
            variant: "destructive",
          });
          return false;
        }
      }

      // Always use RPC to ensure points are properly handled
      const { error: insertError } = await supabase.rpc('complete_task_for_member', {
        p_task_id: task.id,
        p_completed_by: completerId,
      });

      if (insertError) {
        console.error('Error completing task:', insertError);
        
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

      toast({
        title: "Task Completed!",
        description: `+${task.points} points earned`,
      });

      onSuccess?.();
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

      // Find the completion record for this completer (prefer local state, fallback to DB)
      let completion = task.task_completions?.find(
        (c) => c.completed_by === completerId
      );

      if (!completion) {
        const { data: rows, error: fetchCompletionError } = await supabase
          .from('task_completions')
          .select('id, completed_at')
          .eq('task_id', task.id)
          .eq('completed_by', completerId)
          .order('completed_at', { ascending: false })
          .limit(1);

        if (fetchCompletionError) {
          console.error('Error fetching latest completion:', fetchCompletionError);
          toast({
            title: "Error",
            description: fetchCompletionError.message || "Failed to find completion to remove",
            variant: "destructive",
          });
          return false;
        }

        if (!rows || rows.length === 0) {
          toast({
            title: "Error",
            description: "No completion found to remove",
            variant: "destructive",
          });
          return false;
        }

        completion = rows[0] as any;
      }

      // Always use RPC to ensure points are properly handled
      const { error } = await supabase.rpc('uncomplete_task_for_member', {
        p_completion_id: completion.id,
      });

      if (error) {
        console.error('Error uncompleting task:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to uncomplete task",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Task Uncompleted",
        description: `-${task.points} points removed`,
      });

      onSuccess?.();
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
