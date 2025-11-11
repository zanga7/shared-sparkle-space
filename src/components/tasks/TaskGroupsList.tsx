import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AddButton } from '@/components/ui/add-button';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { Progress } from '@/components/ui/progress';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Task, Profile } from '@/types/task';
import { cn, getMemberColorClasses } from '@/lib/utils';
import { Sun, Clock3, Moon, FileText } from 'lucide-react';

type TaskGroup = 'morning' | 'midday' | 'evening' | 'general';

interface TaskGroupsListProps {
  tasks: Task[];
  allTasks: Task[];
  familyMembers: Profile[];
  onTaskToggle: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onAddTask?: (group: TaskGroup) => void;
  onDragEnd: (result: DropResult) => void;
  showActions: boolean;
  memberId?: string;
  memberColor?: string;
  droppableIdPrefix?: string;
}

export const TaskGroupsList = ({
  tasks,
  allTasks,
  familyMembers,
  onTaskToggle,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onDragEnd,
  showActions,
  memberId,
  memberColor,
  droppableIdPrefix = ''
}: TaskGroupsListProps) => {
  const memberColors = memberColor ? getMemberColorClasses(memberColor) : null;

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

  const pendingTasks = tasks.filter(task => 
    !task.task_completions || task.task_completions.length === 0
  );
  
  const completedTasks = tasks.filter(task => 
    task.task_completions && task.task_completions.length > 0
  );

  const pendingGroups = groupTasks(pendingTasks);
  const completedGroups = groupTasks(completedTasks);

  const getTaskGroupIcon = (group: TaskGroup) => {
    switch (group) {
      case 'morning': return Sun;
      case 'midday': return Clock3;
      case 'evening': return Moon;
      case 'general': return FileText;
    }
  };

  const getTaskGroupTitle = (group: TaskGroup) => {
    switch (group) {
      case 'morning': return 'Morning';
      case 'midday': return 'Midday';
      case 'evening': return 'Evening';
      case 'general': return 'General';
    }
  };

  const shouldGroupBeOpenByDefault = (group: TaskGroup): boolean => {
    const now = new Date();
    const hour = now.getHours();
    
    switch (group) {
      case 'morning': return hour >= 6 && hour < 12;
      case 'midday': return hour >= 11 && hour < 16;
      case 'evening': return hour >= 15 || hour < 6;
      case 'general': return true;
    }
  };

  const renderTaskGroup = (
    group: TaskGroup,
    groupTasks: Task[],
    groupType: 'pending' | 'completed'
  ) => {
    if (groupTasks.length === 0) return null;

    const Icon = getTaskGroupIcon(group);
    const groupTitle = getTaskGroupTitle(group);
    const isCompleted = groupType === 'completed';
    const droppableId = `${droppableIdPrefix}${groupType}-${group}`;
    
    const completedGroupTasks = groupTasks.filter(task => 
      task.task_completions && task.task_completions.length > 0
    );
    const progress = groupTasks.length > 0 
      ? Math.round((completedGroupTasks.length / groupTasks.length) * 100)
      : 0;

    return (
      <AccordionItem value={droppableId} key={droppableId}>
        <AccordionTrigger className="text-sm font-medium px-3 py-2 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{groupTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {completedGroupTasks.length}/{groupTasks.length}
              </span>
              {groupTasks.length > 0 && (
                <Progress value={progress} className="w-12 h-1" />
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3 pt-1">
          <Droppable droppableId={droppableId} isDropDisabled={isCompleted}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "space-y-2 min-h-[60px] transition-colors",
                  snapshot.isDraggingOver && !isCompleted && "bg-accent/50 rounded-lg"
                )}
              >
                {groupTasks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {snapshot.isDraggingOver ? (
                      <p className="text-xs">Drop task here</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs">No tasks in this group</p>
                        <div className="text-xs text-muted-foreground">
                          Drag tasks here or create new ones
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  groupTasks.map((task, index) => (
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
                          {/* Drag Handle */}
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
                            allTasks={allTasks}
                            familyMembers={familyMembers}
                            onToggle={onTaskToggle}
                            onEdit={onEditTask}
                            onDelete={onDeleteTask}
                            showActions={showActions && !snapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
                
                {/* Add Task Button for this group */}
                {!isCompleted && onAddTask && showActions && (
                  <div className="pt-2 border-t border-dashed">
                    <AddButton
                      className={cn(
                        "w-full text-xs",
                        memberColors?.border,
                        memberColors?.text
                      )}
                      text={`Add ${groupTitle} Task`}
                      onClick={() => onAddTask(group)}
                    />
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const defaultOpenValues = [
    'morning', 'midday', 'evening', 'general'
  ]
    .filter(group => shouldGroupBeOpenByDefault(group as TaskGroup))
    .map(group => `${droppableIdPrefix}pending-${group}`);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Accordion 
        type="multiple" 
        defaultValue={defaultOpenValues}
        className="space-y-2"
      >
        {/* Pending Tasks */}
        {renderTaskGroup('morning', pendingGroups.morning, 'pending')}
        {renderTaskGroup('midday', pendingGroups.midday, 'pending')}
        {renderTaskGroup('evening', pendingGroups.evening, 'pending')}
        {renderTaskGroup('general', pendingGroups.general, 'pending')}
        
        {/* Completed Tasks - limited display */}
        {completedTasks.length > 0 && (
          <>
            {renderTaskGroup('morning', completedGroups.morning.slice(0, 2), 'completed')}
            {renderTaskGroup('midday', completedGroups.midday.slice(0, 2), 'completed')}
            {renderTaskGroup('evening', completedGroups.evening.slice(0, 2), 'completed')}
            {renderTaskGroup('general', completedGroups.general.slice(0, 2), 'completed')}
          </>
        )}
      </Accordion>
    </DragDropContext>
  );
};
