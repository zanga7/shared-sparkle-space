import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AddButton } from '@/components/ui/add-button';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { getMemberColorClasses } from '@/lib/utils';
import { Users, Plus } from 'lucide-react';
import { Task, Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
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

  // Group tasks by task_group field
  const groupTasks = (tasks: Task[]) => {
    const groups = {
      morning: tasks.filter(task => task.task_group === 'morning'),
      midday: tasks.filter(task => task.task_group === 'midday'),
      evening: tasks.filter(task => task.task_group === 'evening'),
      general: tasks.filter(task => !task.task_group || task.task_group === 'general')
    };
    return groups;
  };

  const pendingGroups = groupTasks(pendingTasks);
  const completedGroups = groupTasks(completedTasks);

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
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      toast({
        title: 'Error',
        description: 'Task not found. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Parse droppable IDs (format: "pending-groupname" or "completed-groupname")
    const parseDroppableId = (id: string) => {
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
        updateData.task_group = destInfo.group;
        updateData.due_date = getGroupDueDate(destInfo.group as TaskGroup);
        needsUpdate = true;
      }

      if (needsUpdate) {
        // Update database
        const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', taskId);

        if (updateError) {
          throw updateError;
        }

        toast({
          title: 'Task Updated',
          description: `Task moved to ${destInfo.group}`,
        });

        // Trigger refresh
        if (onTaskComplete) {
          // Using this callback to trigger refresh in parent
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('task-updated'));
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderTaskGroup = (groupName: string, groupTasks: Task[], groupType: 'pending' | 'completed') => {
    if (groupTasks.length === 0) return null;

    const groupTitle = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    const isCompleted = groupType === 'completed';
    
    return (
      <AccordionItem value={`${groupType}-${groupName}`} key={`${groupType}-${groupName}`}>
        <AccordionTrigger className="text-sm font-medium">
          {groupTitle} ({groupTasks.length})
        </AccordionTrigger>
        <AccordionContent>
          <Droppable droppableId={`${groupType}-${groupName}`} isDropDisabled={isCompleted}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "space-y-2 min-h-[60px] transition-colors",
                  snapshot.isDraggingOver && !isCompleted && "bg-accent/50 rounded-lg p-2"
                )}
              >
                {groupTasks.map((task, index) => (
                  <Draggable 
                    key={task.id} 
                    draggableId={task.id} 
                    index={index}
                    isDragDisabled={isCompleted}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "transition-all duration-200 group relative",
                          snapshot.isDragging && "shadow-xl rotate-2 scale-105 z-50 ring-2 ring-primary/30"
                        )}
                      >
                        {/* Drag Handle - appears on hover */}
                        {!isCompleted && (
                          <div
                            {...provided.dragHandleProps}
                            data-drag-handle="true"
                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-20 bg-background/90 backdrop-blur-sm rounded p-1.5 border border-border/50 shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground pointer-events-none">
                              <circle cx="2" cy="2" r="0.8" fill="currentColor"/>
                              <circle cx="5" cy="2" r="0.8" fill="currentColor"/>
                              <circle cx="8" cy="2" r="0.8" fill="currentColor"/>
                              <circle cx="2" cy="5" r="0.8" fill="currentColor"/>
                              <circle cx="5" cy="5" r="0.8" fill="currentColor"/>
                              <circle cx="8" cy="5" r="0.8" fill="currentColor"/>
                              <circle cx="2" cy="8" r="0.8" fill="currentColor"/>
                              <circle cx="5" cy="8" r="0.8" fill="currentColor"/>
                              <circle cx="8" cy="8" r="0.8" fill="currentColor"/>
                            </svg>
                          </div>
                        )}
                        <EnhancedTaskItem
                          task={task}
                          allTasks={tasks}
                          familyMembers={familyMembers}
                          onToggle={(task) => onTaskComplete(task)}
                          onEdit={profile.role === 'parent' ? onEditTask : undefined}
                          showActions={profile.role === 'parent' && !snapshot.isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </AccordionContent>
      </AccordionItem>
    );
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-y-auto">
              <Accordion type="multiple" defaultValue={[
                'pending-morning', 'pending-midday', 'pending-evening', 'pending-general',
                'completed-morning', 'completed-midday', 'completed-evening', 'completed-general'
              ]} className="space-y-2">
                {/* Pending Tasks */}
                {renderTaskGroup('morning', pendingGroups.morning, 'pending')}
                {renderTaskGroup('midday', pendingGroups.midday, 'pending')}
                {renderTaskGroup('evening', pendingGroups.evening, 'pending')}
                {renderTaskGroup('general', pendingGroups.general, 'pending')}
                
                {/* Show completed tasks if any */}
                {completedTasks.length > 0 && (
                  <>
                    {renderTaskGroup('morning', completedGroups.morning.slice(0, 2), 'completed')}
                    {renderTaskGroup('midday', completedGroups.midday.slice(0, 2), 'completed')}
                    {renderTaskGroup('evening', completedGroups.evening.slice(0, 2), 'completed')}
                    {renderTaskGroup('general', completedGroups.general.slice(0, 2), 'completed')}
                  </>
                )}
              </Accordion>
            </div>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
  );
};