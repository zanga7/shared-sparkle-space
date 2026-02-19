import { useCallback } from 'react';
import { DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Task, Profile } from '@/types/task';
import { TaskGroup, VALID_TASK_GROUPS } from '@/types/taskGroup';
import { getGroupDueDate, getTaskGroupTitle } from '@/utils/taskGroupUtils';

interface UseDashboardDragDropOptions {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  allTasks: Task[];
  profile: Profile | null;
  familyMembers: Profile[];
}

export function useDashboardDragDrop({
  tasks,
  setTasks,
  allTasks,
  profile,
  familyMembers,
}: UseDashboardDragDropOptions) {
  const { toast } = useToast();

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const taskId = draggableId;
    const task = allTasks.find(t => t.id === taskId);

    if (!task) {
      toast({ title: 'Error', description: 'Task not found. Please refresh and try again.', variant: 'destructive' });
      return;
    }

    const isVirtualTask = (task as any).isVirtual === true;
    const isUuid = typeof task.id === 'string' &&
      task.id.length === 36 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id);

    if (isVirtualTask || !isUuid) {
      const parseForMemberCheck = (id: string): string | null => {
        if (id === 'unassigned') return null;
        if (id.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
        const parts = id.split('-');
        if (parts.length >= 6) {
          const memberId = parts.slice(0, 5).join('-');
          if (memberId.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) return memberId;
        }
        return null;
      };

      const sourceMember = parseForMemberCheck(source.droppableId);
      const destMember = parseForMemberCheck(destination.droppableId);

      if (sourceMember !== destMember) {
        toast({ title: 'Not supported', description: 'Recurring task instances cannot be reassigned to different members. Edit the recurring task series instead.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Recurring task', description: 'To change the time slot for recurring tasks, edit the series in task settings.' });
      return;
    }

    const previousTasks = [...tasks];

    const parseDroppableId = (id: string): { memberId: string | null; group: string | null } => {
      if (id === 'unassigned') return { memberId: null, group: null };
      if (id.length === 36 && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return { memberId: id, group: null };
      const parts = id.split('-');
      if (parts.length >= 6) {
        const memberId = parts.slice(0, 5).join('-');
        const remainder = parts.slice(5).join('-');
        if (memberId.length === 36 && memberId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          const group = remainder.replace(/^pending-/, '').replace(/^completed-/, '');
          if (VALID_TASK_GROUPS.includes(group as TaskGroup)) return { memberId, group };
        }
      }
      if (VALID_TASK_GROUPS.includes(id as TaskGroup)) return { memberId: null, group: id };
      return { memberId: null, group: null };
    };

    const sourceInfo = parseDroppableId(source.droppableId);
    const destInfo = parseDroppableId(destination.droppableId);

    if (sourceInfo.memberId === null && sourceInfo.group === null && source.droppableId !== 'unassigned') {
      toast({ title: 'Error', description: 'Invalid drag operation. Please try again.', variant: 'destructive' });
      return;
    }
    if (destInfo.memberId === null && destInfo.group === null && destination.droppableId !== 'unassigned') {
      toast({ title: 'Error', description: 'Invalid drop location. Please try again.', variant: 'destructive' });
      return;
    }

    try {
      const updateData: any = {};
      let needsUpdate = false;

      const currentTask = allTasks.find(t => t.id === taskId);
      const isGroupTask = currentTask && (
        (currentTask.assignees && currentTask.assignees.length > 1) ||
        currentTask.completion_rule === 'everyone'
      );

      if (sourceInfo.memberId !== destInfo.memberId && isGroupTask) {
        toast({ title: 'Cannot reassign', description: 'Tasks assigned to everyone cannot be moved to a specific member. Edit the task to change assignments.' });
        return;
      }

      if (sourceInfo.memberId !== destInfo.memberId && destInfo.memberId !== null) {
        const { error: deleteError } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
        if (deleteError) throw deleteError;
        updateData.assigned_to = destInfo.memberId;
        needsUpdate = true;
        const { error: insertError } = await supabase.from('task_assignees').insert({
          task_id: taskId,
          profile_id: destInfo.memberId,
          assigned_by: profile?.id
        });
        if (insertError) throw insertError;
      }

      if (destInfo.group && destInfo.group !== sourceInfo.group) {
        updateData.task_group = destInfo.group;
        if (currentTask?.due_date) updateData.due_date = getGroupDueDate(destInfo.group as TaskGroup);
        needsUpdate = true;
      }

      if (needsUpdate) {
        setTasks(prevTasks => prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              ...updateData,
              ...(destInfo.memberId !== sourceInfo.memberId && destInfo.memberId && {
                assigned_to: destInfo.memberId,
                assignees: [{
                  id: crypto.randomUUID(),
                  profile_id: destInfo.memberId,
                  assigned_at: new Date().toISOString(),
                  assigned_by: profile?.id || '',
                  profile: familyMembers.find(m => m.id === destInfo.memberId) || {
                    id: destInfo.memberId,
                    display_name: 'Unknown',
                    role: 'child' as const,
                    color: 'gray'
                  }
                }]
              })
            };
          }
          return t;
        }));

        const { error: updateError } = await supabase.from('tasks').update(updateData).eq('id', taskId);
        if (updateError) throw updateError;

        const assignedMember = familyMembers.find(m => m.id === destInfo.memberId);
        let toastMessage = '';
        if (sourceInfo.memberId !== destInfo.memberId && destInfo.memberId) {
          toastMessage = `Task assigned to ${assignedMember?.display_name || 'member'}`;
        } else if (destInfo.memberId === null && sourceInfo.memberId !== null) {
          toastMessage = 'Task moved to unassigned';
        }
        if (destInfo.group && destInfo.group !== sourceInfo.group) {
          const groupMessage = `moved to ${getTaskGroupTitle(destInfo.group as TaskGroup)}`;
          toastMessage = toastMessage ? `${toastMessage} and ${groupMessage}` : `Task ${groupMessage}`;
        }
        toast({ title: 'Task updated', description: toastMessage });
      }
    } catch (error) {
      setTasks(previousTasks);
      toast({ title: 'Failed to move task', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  }, [tasks, allTasks, profile, familyMembers, setTasks, toast]);

  return { handleDragEnd };
}
