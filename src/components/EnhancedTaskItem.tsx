import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Edit,
  Trash2,
  AlertTriangle,
  Target,
  Repeat,
  UserCheck,
  Users,
  RotateCw,
  Goal
} from 'lucide-react';
import { format, isAfter, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Task, Profile } from '@/types/task';
import { TaskAssigneesDisplay } from '@/components/ui/task-assignees-display';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useTaskGoalConnections } from '@/hooks/useTaskGoalConnection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EnhancedTaskItemProps {
  task: Task;
  allTasks: Task[];
  familyMembers: Profile[];
  onToggle: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  showActions?: boolean;
  currentMemberId?: string;
  isDragging?: boolean;
  memberColor?: string;
  isCompleting?: boolean;
  isUnassigned?: boolean;
}

export const EnhancedTaskItem = ({ 
  task, 
  allTasks, 
  familyMembers, 
  onToggle, 
  onEdit, 
  onDelete,
  showActions = true,
  currentMemberId,
  isDragging = false,
  memberColor,
  isCompleting = false,
  isUnassigned = false
}: EnhancedTaskItemProps) => {
  const [showDetails, setShowDetails] = useState(false);

  // Check if task is connected to any goals
  const { data: goalConnections } = useTaskGoalConnections(
    task.id,
    (task as any).series_id,
    task.rotating_task_id
  );

  // Determine the completion status based on the task's completion rule
  const hasAnyCompletion = task.task_completions && task.task_completions.length > 0;
  const isOverdue = task.due_date && isAfter(new Date(), new Date(task.due_date)) && !hasAnyCompletion;
  const assignedProfile = familyMembers.find(member => member.id === task.assigned_to);
  
  // For display purposes, determine which member we're checking for
  let checkMemberId = currentMemberId;
  if (!currentMemberId && task.assignees?.length === 1) {
    checkMemberId = task.assignees[0].profile_id;
  } else if (!currentMemberId && task.assigned_to) {
    checkMemberId = task.assigned_to;
  }
  
  // Get the first completer for "anyone" tasks
  const firstCompletion = task.task_completions?.[0];
  const firstCompleterProfile = firstCompletion 
    ? familyMembers.find(m => m.id === firstCompletion.completed_by) 
    : null;
  
  // Determine completion status based on completion rule
  // For "any_one" tasks: if ANYONE completed it, show as complete for ALL members
  // For "everyone" tasks: only show as complete if THIS SPECIFIC member completed it
  const isCompletedByMe = task.completion_rule === 'any_one' 
    ? (task.task_completions || []).some(c => c.completed_by === checkMemberId) // Did I complete it?
    : (task.task_completions || []).some(c => c.completed_by === checkMemberId); // Only this member's completion
  
  // For "any_one" tasks: task is complete if anyone completed it
  // For "everyone" tasks: for THIS viewer, it's complete if THEY completed it
  const isCompleted = task.completion_rule === 'any_one' 
    ? hasAnyCompletion 
    : isCompletedByMe; // Each person sees their own completion state
  
  // For "anyone" tasks completed by someone else - show who completed it
  const isCompletedBySomeoneElse = task.completion_rule === 'any_one' && hasAnyCompletion && !isCompletedByMe;

  // Get days until due
  const getDaysUntilDue = () => {
    if (!task.due_date) return null;
    const days = differenceInDays(new Date(task.due_date), new Date());
    return days;
  };

  const daysUntilDue = getDaysUntilDue();

  // Get member colors if memberColor is provided
  const { styles: colorStyles } = useMemberColor(memberColor);

  return (
    <div 
      className={cn(
        "group/task relative rounded-lg p-3 transition-all hover:shadow-md",
        isOverdue && "ring-1 ring-destructive/50",
        !isCompleted && !isCompletedBySomeoneElse && !(task as any).isVirtual && "cursor-grab active:cursor-grabbing",
        isUnassigned && "bg-muted/30",
        isCompletedBySomeoneElse && "opacity-60" // Grey out for "anyone" tasks completed by someone else
      )}
      style={!isUnassigned ? (isCompleted || isCompletedBySomeoneElse ? colorStyles.bg20 : colorStyles.bg50) : undefined}
    >
      <div className="flex items-start gap-2">
        {/* Complete/Uncomplete Button */}
        <Button 
          size="sm" 
          variant={isCompletedByMe ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            // For "any_one" tasks completed by someone else, prevent interaction
            if (task.completion_rule === 'any_one' && isCompleted && !isCompletedByMe) {
              return;
            }
            onToggle(task);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isCompleting || (task.completion_rule === 'any_one' && isCompleted && !isCompletedByMe)}
          className={cn(
            "shrink-0 w-7 h-7 p-0 cursor-pointer transition-all",
            isCompletedByMe 
              ? "bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95" 
              : "hover:border-green-500 hover:text-green-500",
            isCompleting && "opacity-50 cursor-wait",
            (task.completion_rule === 'any_one' && isCompleted && !isCompletedByMe) && "opacity-50 cursor-not-allowed"
          )}
          title={
            isCompletedByMe 
              ? (task.completion_rule === 'any_one' 
                  ? "Click to uncomplete and remove points" 
                  : "Click to uncomplete your completion and remove your points")
              : (isCompleted && task.completion_rule === 'any_one'
                  ? "Already completed by someone" 
                  : "Click to complete and earn points")
          }
        >
          {isCompleting ? (
            <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
        </Button>

        {/* Task Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title and Basic Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <h3 className={cn("font-medium text-sm", isCompleted && "line-through text-muted-foreground")}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
              )}
            </div>

            {/* Action Buttons - Only visible on hover */}
            {showActions && !isCompleted && (
              <div className="invisible opacity-0 group-hover/task:visible group-hover/task:opacity-100 transition-all duration-200 flex items-center gap-1 shrink-0">
                {onEdit && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(task);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Compact Badges and Indicators */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Points with Award Info */}
            <Badge variant="outline" className="text-[0.72rem] py-0 h-5 flex items-center gap-1">
              <Target className="h-2.5 w-2.5" />
              {task.points} pts
              {(() => {
                // Handle both regular tasks and virtual tasks
                const virtualTask = task as any;
                const assigneeCount = task.assignees?.length || 
                                     virtualTask.assigned_profiles?.length || 
                                     (task.assigned_profile ? 1 : 0);
                if (assigneeCount > 1) {
                  if (task.completion_rule === 'any_one') {
                    return <span className="text-muted-foreground ml-1">→ first</span>;
                  } else {
                    return <span className="text-muted-foreground ml-1">→ each</span>;
                  }
                }
                return null;
              })()}
            </Badge>

            {/* Show "Completed by [Name]" for "anyone" tasks completed by someone else */}
            {isCompletedBySomeoneElse && firstCompleterProfile && (
              <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                <UserCheck className="h-2 w-2" />
                Completed by {firstCompleterProfile.display_name}
              </Badge>
            )}

            {/* Assignees Display - Hidden when completed */}
            {!isCompleted && !isCompletedBySomeoneElse && (
              <TaskAssigneesDisplay 
                task={task} 
                showNames={false}
                onClick={onEdit ? () => onEdit(task) : undefined}
              />
            )}

            {/* Due Date - Hidden when completed */}
            {!isCompleted && task.due_date && (
              <Badge 
                variant={isOverdue ? "destructive" : daysUntilDue === 0 ? "default" : "outline"} 
                className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5"
              >
                {isOverdue ? (
                  <AlertTriangle className="h-2 w-2" />
                ) : (
                  <Calendar className="h-2 w-2" />
                )}
                {isOverdue ? 'Overdue' : 
                 daysUntilDue === 0 ? 'Today' :
                 daysUntilDue === 1 ? 'Tomorrow' :
                 format(new Date(task.due_date), "MMM d")
                }
              </Badge>
            )}

            {/* Rotating Task Indicator */}
            {task.rotating_task_id && (
              <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                <RotateCw className="h-2 w-2" />
                Rotate
              </Badge>
            )}

            {/* Group Task Indicator - only when truly multi-assignee */}
            {!task.rotating_task_id &&
              (task.completion_rule === 'everyone' || task.completion_rule === 'any_one') &&
              Math.max(
                task.assignees?.length ?? 0,
                typeof (task as any).series_assignee_count === 'number' ? (task as any).series_assignee_count : 0,
                Array.isArray((task as any).assigned_profiles) ? (task as any).assigned_profiles.length : 0,
                task.assigned_to ? 1 : 0
              ) > 1 && (
                <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                  <Users className="h-2 w-2" />
                  Group
                </Badge>
              )}

            {/* Recurrence Indicator */}
            {(task.recurrence_options?.enabled || (task as any).isVirtual) && (
              <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                <Repeat className="h-2 w-2" />
                Repeat
              </Badge>
            )}

            {/* Goal Connection Indicator */}
            {goalConnections && goalConnections.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5 border-primary/30 text-primary">
                      <Goal className="h-2 w-2" />
                      {goalConnections.length === 1 ? 'Goal' : `${goalConnections.length} Goals`}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      {goalConnections.map((gc, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-medium">{gc.goalTitle}</span>
                          {gc.milestoneTitle && (
                            <span className="text-muted-foreground"> → {gc.milestoneTitle}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};