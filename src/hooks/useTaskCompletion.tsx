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
    onSuccess?: () => void,
    completerIdOverride?: string | null
  ): Promise<boolean> => {
    // Prevent double-submissions
    if (completingTasks.has(task.id)) {
      return false;
    }

    setCompletingTasks(prev => new Set(prev).add(task.id));

    try {
      // Determine who is completing the task
      let completerId: string | null = null;
      const memberIdContext = completerIdOverride ?? activeMemberId ?? null;

      // Priority order:
      // 1. If a member context is provided (from column/dashboard), always use it
      // 2. For single-assignee tasks without member context, use that assignee
      // 3. Fall back to current user profile
      if (memberIdContext) {
        completerId = memberIdContext;
      } else if (task.assignees && task.assignees.length === 1) {
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

      // Note: PIN checks are handled by the calling component (ColumnBasedDashboard)
      // to allow it to show the PIN dialog before attempting completion
      // Extract virtual task metadata if present
      // Virtual task ID formats:
      // - "UUID-YYYY-MM-DD" (any_one rule or single assignee)
      // - "UUID-YYYY-MM-DD-profileUUID" (everyone rule with multiple assignees)
      // Where UUID is 36 chars: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      
      // Helper to check if a string looks like a virtual task ID (contains date pattern after UUID)
      // Virtual IDs have format: UUID-YYYY-MM-DD (47 characters: 36 UUID + 1 hyphen + 10 date)
      const isVirtualTaskId = (id: string): boolean => {
        if (!id || typeof id !== 'string') return false;
        // Must be longer than a standard UUID (36 chars)
        if (id.length <= 36) return false;
        // Check for date pattern after the first UUID
        // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-YYYY-MM-DD
        const afterUuid = id.substring(37);
        const hasDatePattern = /^\d{4}-\d{2}-\d{2}/.test(afterUuid);
        console.log('🔍 Virtual ID check:', { id, length: id.length, afterUuid, hasDatePattern });
        return hasDatePattern;
      };
      
      // Determine if this is a virtual task - check ALL possible indicators
      const hasVirtualFlag = task.isVirtual === true;
      const hasSeriesId = !!task.series_id;
      const hasOccurrenceDate = !!task.occurrence_date;
      const hasVirtualIdFormat = isVirtualTaskId(task.id);
      
      const isVirtualTask = hasVirtualFlag || hasSeriesId || hasOccurrenceDate || hasVirtualIdFormat;
      
      console.log('🔍 Virtual task detection:', {
        taskId: task.id,
        hasVirtualFlag,
        hasSeriesId,
        hasOccurrenceDate,
        hasVirtualIdFormat,
        isVirtualTask
      });
      
      // Extract series_id and occurrence_date
      let seriesId: string | null = task.series_id || null;
      let occurrenceDate: string | null = task.occurrence_date 
        ? String(task.occurrence_date).split('T')[0] 
        : null;
      
      // If we detected a virtual task but don't have explicit series_id/occurrence_date,
      // parse them from the composite ID
      if (isVirtualTask && (!seriesId || !occurrenceDate) && typeof task.id === 'string' && task.id.length > 36) {
        const uuidPart = task.id.substring(0, 36);
        const remainder = task.id.substring(37); // Skip the hyphen after UUID
        
        // Extract date (YYYY-MM-DD is first 10 chars of remainder)
        const dateMatch = remainder.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          seriesId = seriesId || uuidPart;
          occurrenceDate = occurrenceDate || dateMatch[1];
        }
      }

      // Call unified RPC that handles everything in one transaction
      // CRITICAL: Never pass composite virtual task IDs as UUIDs
      const taskIdForRpc = isVirtualTask ? null : task.id;
      
      console.log('🔄 Completing task:', {
        taskId: task.id,
        isVirtual: isVirtualTask,
        seriesId,
        occurrenceDate,
        taskIdForRpc,
        completerId
      });
      
      const { data: result, error } = await supabase.rpc('complete_task_unified', {
        p_task_id: taskIdForRpc,
        p_completer_profile_id: completerId,
        p_is_virtual: isVirtualTask,
        p_series_id: seriesId,
        p_occurrence_date: occurrenceDate,
      });

      if (error) {
        console.error('Error completing task:', error);
        
        // Check if it's a duplicate completion
        if (error.message?.includes('already completed')) {
          toast({
            title: "Already Completed",
            description: "This task has already been completed",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to complete task",
            variant: "destructive",
          });
        }
        return false;
      }

      // Parse result
      const completionResult = result as { success: boolean; points_awarded: number; task_id: string } | null;

      // Show success feedback
      toast({
        title: "Task Completed!",
        description: `+${completionResult?.points_awarded || task.points} points earned`,
      });

      // Note: For instant rotation tasks (rotate_on_completion = true), the DB trigger 
      // `handle_rotating_task_completion` automatically creates the next task instance.
      // No edge function call needed - this avoids race conditions and duplicate tasks.
      if (task.rotating_task_id && !isVirtualTask) {
        console.log('🔄 Rotating task completed - DB trigger handles instant rotation if enabled');
      }

      // Success callback if provided
      if (onSuccess) {
        onSuccess();
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
    onSuccess?: () => void,
    completerIdOverride?: string | null
  ): Promise<boolean> => {
    // Prevent double-submissions
    if (completingTasks.has(task.id)) {
      console.log('🚫 Task already being processed (uncomplete):', task.id);
      return false;
    }

    setCompletingTasks(prev => new Set(prev).add(task.id));

    try {
      // Determine which completion to remove - MUST match completeTask logic
      let completerId: string | null = null;
      const memberIdContext = completerIdOverride ?? activeMemberId ?? null;

      // Use same priority as completeTask
      if (memberIdContext) {
        completerId = memberIdContext;
      } else if (task.assignees && task.assignees.length === 1) {
        // For single-assignee tasks, use the assignee's ID
        completerId = task.assignees[0].profile_id;
      } else if (currentUserProfile) {
        completerId = currentUserProfile.id;
      }

      if (!completerId) {
        console.error('❌ No completer ID found for uncomplete');
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
        console.error('❌ No completion found:', { 
          taskId: task.id, 
          completerId, 
          completions: task.task_completions 
        });
        toast({
          title: "Error",
          description: "No completion found to remove",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Uncompleting task:', { 
        taskId: task.id, 
        completionId: completion.id, 
        completerId 
      });

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

      if (!error) {
        // Clear hidden_at so the task reappears in active task lists
        // (tasks are auto-hidden after completion by the cleanup process)
        const realTaskId = task.series_id ? null : task.id;
        if (realTaskId && realTaskId.length === 36) {
          await supabase
            .from('tasks')
            .update({ hidden_at: null })
            .eq('id', realTaskId);
        }
      }

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

       // Success callback if provided (important for virtual/recurring tasks which rely on refresh)
       if (onSuccess) {
         onSuccess();
       }

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
