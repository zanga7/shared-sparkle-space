import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AddButton } from '@/components/ui/add-button';
import { TaskGroupsList } from '@/components/tasks/TaskGroupsList';
import { getMemberColorClasses } from '@/lib/utils';
import { Users } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MemberTasksWidgetProps {
  member: Profile;
  tasks: Task[];
  familyMembers: Profile[];
  profile: Profile;
  onTaskUpdated: () => void;
  onEditTask?: (task: Task) => void;
  onTaskComplete: (task: Task) => void;
  onAddTask: () => void;
}

export const MemberTasksWidget = ({
  member,
  tasks,
  familyMembers,
  profile,
  onEditTask,
  onTaskComplete,
  onAddTask
}: MemberTasksWidgetProps) => {
  const { toast } = useToast();
  const memberColors = getMemberColorClasses(member.color);
  
  const memberTasks = tasks.filter(task => 
    task.assigned_to === member.id || 
    task.assignees?.some(a => a.profile_id === member.id)
  );
  
  const pendingTasks = memberTasks.filter(task => 
    !task.task_completions || task.task_completions.length === 0
  );
  
  const completedTasks = memberTasks.filter(task => 
    task.task_completions && task.task_completions.length > 0
  );

  // Calculate progress percentage
  const progressPercentage = memberTasks.length > 0 
    ? Math.round((completedTasks.length / memberTasks.length) * 100) 
    : 0;

  // Type definition for task groups
  type TaskGroup = 'morning' | 'midday' | 'evening' | 'general';

  // Helper function to get due date based on task group
  const getGroupDueDate = (group: TaskGroup): string | null => {
    const today = new Date();
    
    switch (group) {
      case 'morning':
        const morning = new Date(today);
        morning.setHours(11, 0, 0, 0);
        return morning.toISOString();
      case 'midday':
        const midday = new Date(today);
        midday.setHours(15, 0, 0, 0);
        return midday.toISOString();
      case 'evening':
        const evening = new Date(today);
        evening.setHours(23, 59, 0, 0);
        return evening.toISOString();
      case 'general':
      default:
        return null;
    }
  };

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

    // Parse droppable IDs (format: "pending-groupname" or "completed-groupname")
    const parseDroppableId = (id: string): { status: string | null; group: string | null } => {
      const parts = id.split('-');
      if (parts.length >= 2) {
        const status = parts[0]; // 'pending' or 'completed'
        const group = parts.slice(1).join('-'); // handle groups with dashes
        return { status, group };
      }
      return { status: null, group: null };
    };

    const sourceInfo = parseDroppableId(source.droppableId);
    const destInfo = parseDroppableId(destination.droppableId);

    // Validate parsed IDs
    if (!destInfo.status || !destInfo.group) {
      console.error('Failed to parse destination droppable ID:', destination.droppableId);
      toast({
        title: 'Error',
        description: 'Invalid drop location. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Don't allow moving to completed section via drag
    if (destInfo.status === 'completed') {
      toast({
        title: 'Cannot Move',
        description: 'Tasks must be completed using the checkbox.',
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
    <Card className={cn("h-full flex flex-col", memberColors.border)} style={{ borderWidth: '2px' }}>
      <CardHeader className="pb-4">
        <CardTitle className={cn("flex items-center gap-2 text-xl", memberColors.text)}>
          <Users className="h-6 w-6" />
          Tasks
        </CardTitle>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        {/* Add Task Button */}
        <AddButton 
          text="Add Task"
          onClick={onAddTask}
          className={cn("border-dashed hover:border-solid w-full", memberColors.border)}
        />
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        {memberTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks assigned</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <TaskGroupsList
                tasks={memberTasks}
                allTasks={tasks}
                familyMembers={familyMembers}
                onTaskToggle={onTaskComplete}
                onEditTask={profile.role === 'parent' ? onEditTask : undefined}
                onDragEnd={handleDragEnd}
                showActions={profile.role === 'parent'}
                memberId={member.id}
                memberColor={member.color}
              />
            </DragDropContext>
          </div>
        )}
      </CardContent>
    </Card>
  );
};