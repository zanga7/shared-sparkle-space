import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AddButton } from '@/components/ui/add-button';
import { TaskGroupsList } from '@/components/tasks/TaskGroupsList';
import { useMemberColor } from '@/hooks/useMemberColor';
import { Users } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { TaskGroup } from '@/types/taskGroup';
import { getGroupDueDate } from '@/utils/taskGroupUtils';
import { cn } from '@/lib/utils';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTaskCompletion } from '@/hooks/useTaskCompletion';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { canUpdateTaskDirectly } from '@/utils/taskIdUtils';

interface MemberTasksWidgetProps {
  member: Profile;
  tasks: Task[];
  familyMembers: Profile[];
  profile: Profile;
  onTaskUpdated: () => void;
  onEditTask?: (task: Task) => void;
  onAddTask: () => void;
  activeMemberId?: string | null;
  isDashboardMode?: boolean;
  setTasks?: React.Dispatch<React.SetStateAction<Task[]>>;
  setProfile?: React.Dispatch<React.SetStateAction<Profile | null>>;
  setFamilyMembers?: React.Dispatch<React.SetStateAction<Profile[]>>;
  memberColor?: string;
}

export const MemberTasksWidget = ({
  member,
  tasks,
  familyMembers,
  profile,
  onTaskUpdated,
  onEditTask,
  onAddTask,
  activeMemberId,
  isDashboardMode = false,
  setTasks,
  setProfile,
  setFamilyMembers,
  memberColor
}: MemberTasksWidgetProps) => {
  const { toast } = useToast();
  const { styles: colorStyles } = useMemberColor(memberColor || member.color);
  
  const { completeTask, uncompleteTask, isCompleting } = useTaskCompletion({
    currentUserProfile: profile,
    activeMemberId: activeMemberId || member.id,
    isDashboardMode,
    setTasks,
    setProfile,
    setFamilyMembers
  });

  const handleTaskToggle = async (task: Task) => {
    // Prevent action if task is currently being processed
    if (isCompleting(task.id)) {
      console.log('🚫 Task already being processed:', task.id);
      return;
    }

    // Determine who we're checking for
    const completerId = activeMemberId || member.id;
    if (!completerId) return;

    // Check if THIS specific user/member has completed the task
    const isCompleted = task.task_completions?.some(
      (c) => c.completed_by === completerId
    );

    console.log('🔄 Task toggle (widget):', { 
      taskId: task.id, 
      completerId, 
      isCompleted 
    });

    if (isCompleted) {
      await uncompleteTask(task, () => {
        // Refetch tasks after uncompleting
        onTaskUpdated();
      });
    } else {
      await completeTask(task, () => {
        // Refetch tasks after completing
        onTaskUpdated();
      });
    }
  };
  
  // Filter tasks for this member - handle both regular tasks and virtual tasks
  const memberTasks = tasks.filter(task => {
    // Check regular assigned_to field
    if (task.assigned_to === member.id) return true;
    
    // Check assignees array (regular tasks from DB)
    if (task.assignees?.some(a => a.profile_id === member.id)) return true;
    
    // Check assigned_profiles array (virtual tasks from series)
    const virtualTask = task as any;
    if (virtualTask.assigned_profiles?.includes(member.id)) return true;
    
    return false;
  });
  
  // For "everyone" tasks, check if THIS member completed
  // For "any_one" tasks, check if anyone completed
  const isTaskCompletedForMember = (task: Task): boolean => {
    if (!task.task_completions || task.task_completions.length === 0) return false;
    
    if (task.completion_rule === 'everyone') {
      // For "everyone" tasks, only consider completed if THIS member completed
      return task.task_completions.some(c => c.completed_by === member.id);
    } else {
      // For "any_one" tasks, any completion counts
      return true;
    }
  };
  
  const pendingTasks = memberTasks.filter(task => !isTaskCompletedForMember(task));
  const completedTasks = memberTasks.filter(task => isTaskCompletedForMember(task));

  // Calculate progress percentage
  const progressPercentage = memberTasks.length > 0 
    ? Math.round((completedTasks.length / memberTasks.length) * 100) 
    : 0;

  // Handle drag end for task reordering and group changes
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area or in same position
    if (!destination || 
        (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    const taskId = draggableId;
    const task = memberTasks.find(t => t.id === taskId);
    
    if (!task) {
      toast({
        title: 'Error',
        description: 'Task not found. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Block drag-and-drop for virtual/recurring tasks
    if (!canUpdateTaskDirectly(task.id, task.isVirtual)) {
      toast({
        title: 'Not supported',
        description: 'Recurring task instances cannot be moved. Edit the series instead.',
        variant: 'destructive',
      });
      return;
    }

    // Parse droppable IDs (format: just "groupname" like "morning", "midday", etc.)
    const parseDroppableId = (id: string): { group: string | null } => {
      // Check if it's a valid task group
      const validGroups = ['morning', 'midday', 'afternoon', 'evening', 'general'];
      if (validGroups.includes(id)) {
        return { group: id };
      }
      return { group: null };
    };

    const sourceInfo = parseDroppableId(source.droppableId);
    const destInfo = parseDroppableId(destination.droppableId);

    // Validate parsed IDs
    if (!destInfo.group) {
      console.error('Failed to parse destination droppable ID:', destination.droppableId);
      toast({
        title: 'Error',
        description: 'Invalid drop location. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updateData: any = {};
      let needsUpdate = false;

      // Handle task group change
      if (destInfo.group && destInfo.group !== sourceInfo.group) {
        console.log('Updating task group from', sourceInfo.group, 'to', destInfo.group);
        updateData.task_group = destInfo.group;
        updateData.due_date = getGroupDueDate(destInfo.group as TaskGroup);
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log('Applying update:', updateData);
        
        // Update database
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', taskId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        console.log('Task update successful');

        toast({
          title: 'Task Updated',
          description: `Task moved to ${destInfo.group}`,
        });

        // Trigger parent component refresh
        onTaskUpdated();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('task-updated'));
        }, 100);
      }
    } catch (error) {
      console.error('Error in drag and drop operation:', error);
      toast({
        title: 'Failed to move task',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      
      // Force refresh to restore correct state
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('task-updated'));
      }, 100);
    }
  };

  return (
    <Card className="h-full flex flex-col" style={colorStyles.bg10}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl" style={colorStyles.text}>
          <Users className="h-6 w-6" />
          Tasks
        </CardTitle>
        
        <div className="space-y-2">
          <Progress 
            value={progressPercentage} 
            className="h-2" 
            style={{ 
              backgroundColor: 'hsl(var(--secondary))' 
            }}
            indicatorClassName="transition-all"
            indicatorStyle={colorStyles.bg}
          />
        </div>
        
        <AddButton 
          text="Add Task"
          onClick={onAddTask}
          className="border-dashed hover:border-solid w-full"
          style={{ ...colorStyles.border, ...colorStyles.text }}
        />
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        {memberTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No tasks assigned</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <TaskGroupsList
                tasks={memberTasks}
                allTasks={tasks}
                familyMembers={familyMembers}
                onTaskToggle={handleTaskToggle}
                onEditTask={profile.role === 'parent' ? onEditTask : undefined}
                onDragEnd={handleDragEnd}
                showActions={profile.role === 'parent'}
                memberId={member.id}
                memberColor={member.color}
                isCompleting={isCompleting}
              />
            </DragDropContext>
          </div>
        )}
      </CardContent>
    </Card>
  );
};