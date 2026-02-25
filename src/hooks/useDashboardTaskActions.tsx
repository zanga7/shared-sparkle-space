import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskCompletion } from '@/hooks/useTaskCompletion';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { Task, Profile } from '@/types/task';

interface UseDashboardTaskActionsOptions {
  profile: Profile | null;
  familyMembers: Profile[];
  activeMemberId: string | null;
  dashboardMode: boolean;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  setFamilyMembers: React.Dispatch<React.SetStateAction<Profile[]>>;
  refreshTasksOnly: () => Promise<void>;
  fetchTaskSeries: () => Promise<void>;
}

export function useDashboardTaskActions({
  profile,
  familyMembers,
  activeMemberId,
  dashboardMode,
  setTasks,
  setProfile,
  setFamilyMembers,
  refreshTasksOnly,
  fetchTaskSeries,
}: UseDashboardTaskActionsOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'complete_task' | 'delete_list_item';
    taskId?: string;
    requiredMemberId?: string;
    onSuccess: () => void;
  } | null>(null);

  const {
    canPerformAction,
    authenticateMemberPin,
    isAuthenticating,
  } = useDashboardAuth();

  const { completeTask: completeTaskHandler, uncompleteTask: uncompleteTaskHandler, isCompleting } = useTaskCompletion({
    currentUserProfile: profile,
    activeMemberId,
    isDashboardMode: dashboardMode,
    setTasks,
    setProfile,
    setFamilyMembers,
  });

  const invalidateGoalCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['goal-linked-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-series'] });
    queryClient.invalidateQueries({ queryKey: ['goal-linked-rotating'] });
    queryClient.invalidateQueries({ queryKey: ['consistency-completions'] });
    queryClient.invalidateQueries({ queryKey: ['target-completions'] });
  }, [queryClient]);

  const completeTask = useCallback(async (task: Task, columnMemberId?: string) => {
    await completeTaskHandler(task, () => {
      refreshTasksOnly();
      invalidateGoalCaches();
    }, columnMemberId);
  }, [completeTaskHandler, refreshTasksOnly, invalidateGoalCaches]);

  const uncompleteTask = useCallback(async (task: Task, columnMemberId?: string) => {
    await uncompleteTaskHandler(task, () => {
      refreshTasksOnly();
      invalidateGoalCaches();
    }, columnMemberId);
  }, [uncompleteTaskHandler, refreshTasksOnly, invalidateGoalCaches]);

  const handleTaskToggle = useCallback(async (task: Task, columnMemberId?: string) => {
    if (isCompleting(task.id)) return;

    const completerId = columnMemberId || activeMemberId || profile?.id;
    if (!completerId) return;

    let checkCompleterId = completerId;
    if (!activeMemberId && !columnMemberId && task.assignees?.length === 1) {
      checkCompleterId = task.assignees[0].profile_id;
    } else if (!activeMemberId && !columnMemberId && task.assigned_to) {
      checkCompleterId = task.assigned_to;
    }

    const isCompleted = task.task_completions?.some((c) => c.completed_by === checkCompleterId);

    if (dashboardMode && !isCompleted && completerId) {
      const { canProceed, needsPin } = await canPerformAction(completerId, 'task_completion');
      if (needsPin && !canProceed) {
        const member = familyMembers.find(m => m.id === completerId);
        if (member) {
          setPendingAction({
            type: 'complete_task',
            taskId: task.id,
            requiredMemberId: completerId,
            onSuccess: () => completeTask(task, columnMemberId),
          });
          setPinDialogOpen(true);
          return;
        }
      }
    }

    if (isCompleted) {
      uncompleteTask(task, columnMemberId);
    } else {
      completeTask(task, columnMemberId);
    }
  }, [activeMemberId, profile?.id, dashboardMode, familyMembers, isCompleting, canPerformAction, completeTask, uncompleteTask]);

  const initiateTaskDeletion = useCallback(async (task: Task) => {
    if (task.isVirtual && task.series_id) {
      setDeletingTask({ ...task, isVirtual: true, series_id: task.series_id, occurrence_date: task.occurrence_date } as Task);
      return;
    }

    const { data: rotatingTask } = await supabase
      .from('rotating_tasks')
      .select('id, name, allow_multiple_completions')
      .eq('name', task.title)
      .eq('family_id', profile?.family_id)
      .eq('is_active', true)
      .single();

    if (rotatingTask && dashboardMode) {
      if (profile?.role !== 'parent') {
        toast({ title: 'Permission Denied', description: 'Only parents can delete rotating tasks.', variant: 'destructive' });
        return;
      }
      setPendingAction({
        type: 'complete_task',
        taskId: task.id,
        requiredMemberId: profile.id,
        onSuccess: () => {
          setDeletingTask(task);
          (task as any).isRotatingTask = true;
        }
      });
      setPinDialogOpen(true);
      return;
    }

    setDeletingTask(task);
  }, [profile, dashboardMode, toast]);

  const deleteTask = useCallback(async () => {
    if (!deletingTask) return;

    if ((deletingTask as any).isVirtual && (deletingTask as any).series_id) {
      try {
        const { error } = await supabase.from('recurrence_exceptions').insert({
          series_id: (deletingTask as any).series_id,
          series_type: 'task',
          exception_date: (deletingTask as any).occurrence_date,
          exception_type: 'skip',
          created_by: profile?.id
        });
        if (error) throw error;
        toast({ title: 'Occurrence Skipped', description: 'This task occurrence has been removed' });
        setDeletingTask(null);
        await fetchTaskSeries();
        await refreshTasksOnly();
        return;
      } catch {
        toast({ title: 'Error', description: 'Failed to skip task occurrence', variant: 'destructive' });
        return;
      }
    }

    try {
      const { data: rotatingTask } = await supabase
        .from('rotating_tasks')
        .select('id, name, allow_multiple_completions, current_member_index, member_order')
        .eq('name', deletingTask.title)
        .eq('family_id', profile?.family_id)
        .eq('is_active', true)
        .single();

      const { error } = await supabase.from('tasks').delete().eq('id', deletingTask.id);
      if (error) throw error;

      toast({ title: 'Task Deleted', description: 'Task has been removed successfully' });
      setDeletingTask(null);
      setTasks(prevTasks => prevTasks.filter(t => t.id !== deletingTask.id));

      if (rotatingTask) {
        try {
          await supabase.functions.invoke('generate-rotating-tasks');
          toast({ title: 'Next Task Generated', description: 'The task has been reassigned to the next person in rotation.' });
        } catch {
          toast({ title: 'Warning', description: 'Task deleted but failed to generate next instance.', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    }
  }, [deletingTask, profile, setTasks, toast, fetchTaskSeries, refreshTasksOnly]);

  return {
    editingTask,
    setEditingTask,
    deletingTask,
    setDeletingTask,
    pinDialogOpen,
    setPinDialogOpen,
    switchDialogOpen,
    setSwitchDialogOpen,
    pendingAction,
    setPendingAction,
    isCompleting,
    authenticateMemberPin,
    isAuthenticating,
    handleTaskToggle,
    initiateTaskDeletion,
    deleteTask,
    completeTask,
    uncompleteTask,
  };
}
