import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AddButton } from '@/components/ui/add-button';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { Progress } from '@/components/ui/progress';
import { Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Task, Profile } from '@/types/task';
import { TaskGroup, TASK_GROUPS_ORDER } from '@/types/taskGroup';
import { 
  getTaskGroupIcon, 
  getTaskGroupTitle, 
  shouldGroupBeOpenByDefault 
} from '@/utils/taskGroupUtils';
import { cn, getMemberColorClasses } from '@/lib/utils';

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
      afternoon: tasks.filter(task => task.task_group === 'afternoon'),
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

  const renderTaskGroup = (
    group: TaskGroup,
    groupTasks: Task[],
    groupType: 'pending' | 'completed'
  ) => {
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
                            "transition-all duration-200 relative flex items-start gap-2",
                            snapshot.isDragging && "shadow-xl rotate-2 scale-105 z-50 ring-2 ring-primary/30"
                          )}
                        >
                          {/* Dedicated Drag Handle */}
                          {!isCompleted && (
                            <div
                              {...provided.dragHandleProps}
                              className="flex-shrink-0 mt-3 cursor-grab active:cursor-grabbing touch-none"
                            >
                              <div className="p-1.5 rounded hover:bg-accent transition-colors">
                                <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
                                  <circle cx="4" cy="4" r="1.2" fill="currentColor"/>
                                  <circle cx="8" cy="4" r="1.2" fill="currentColor"/>
                                  <circle cx="12" cy="4" r="1.2" fill="currentColor"/>
                                  <circle cx="4" cy="8" r="1.2" fill="currentColor"/>
                                  <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
                                  <circle cx="12" cy="8" r="1.2" fill="currentColor"/>
                                  <circle cx="4" cy="12" r="1.2" fill="currentColor"/>
                                  <circle cx="8" cy="12" r="1.2" fill="currentColor"/>
                                  <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
                                </svg>
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
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

  const defaultOpenValues = TASK_GROUPS_ORDER.map(group => `${droppableIdPrefix}pending-${group}`);

  return (
    <Accordion 
      type="multiple" 
      defaultValue={defaultOpenValues}
      className="space-y-2"
    >
      {/* Pending Tasks */}
      {renderTaskGroup('morning', pendingGroups.morning, 'pending')}
      {renderTaskGroup('midday', pendingGroups.midday, 'pending')}
      {renderTaskGroup('afternoon', pendingGroups.afternoon, 'pending')}
      {renderTaskGroup('evening', pendingGroups.evening, 'pending')}
      {renderTaskGroup('general', pendingGroups.general, 'pending')}
      
      {/* Completed Tasks - limited display */}
      {completedTasks.length > 0 && (
        <>
          {renderTaskGroup('morning', completedGroups.morning.slice(0, 2), 'completed')}
          {renderTaskGroup('midday', completedGroups.midday.slice(0, 2), 'completed')}
          {renderTaskGroup('afternoon', completedGroups.afternoon.slice(0, 2), 'completed')}
          {renderTaskGroup('evening', completedGroups.evening.slice(0, 2), 'completed')}
          {renderTaskGroup('general', completedGroups.general.slice(0, 2), 'completed')}
        </>
      )}
    </Accordion>
  );
};
