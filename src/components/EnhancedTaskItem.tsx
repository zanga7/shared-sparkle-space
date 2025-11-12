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
  Repeat
} from 'lucide-react';
import { format, isAfter, differenceInDays } from 'date-fns';
import { cn, getMemberColorClasses } from '@/lib/utils';
import { Task, Profile } from '@/types/task';
import { TaskAssigneesDisplay } from '@/components/ui/task-assignees-display';

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
  memberColor
}: EnhancedTaskItemProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const isCompleted = task.task_completions && task.task_completions.length > 0;
  const isOverdue = task.due_date && isAfter(new Date(), new Date(task.due_date)) && !isCompleted;
  const assignedProfile = familyMembers.find(member => member.id === task.assigned_to);
  const isCompletedByMe = (task.task_completions || []).some(c => c.completed_by === currentMemberId);

  // Get days until due
  const getDaysUntilDue = () => {
    if (!task.due_date) return null;
    const days = differenceInDays(new Date(task.due_date), new Date());
    return days;
  };

  const daysUntilDue = getDaysUntilDue();

  // Get member colors if memberColor is provided
  const memberColors = memberColor ? getMemberColorClasses(memberColor) : null;

  return (
    <div 
      className={cn(
        "group/task relative rounded-lg p-3 transition-all hover:shadow-md",
        isCompleted && memberColors?.bg20,
        !isCompleted && memberColors?.bg50,
        isOverdue && "ring-1 ring-destructive/50",
        !isCompleted && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Complete/Uncomplete Button */}
        <Button 
          size="sm" 
          variant={isCompletedByMe ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 w-7 h-7 p-0 cursor-pointer transition-all",
            isCompletedByMe 
              ? "bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95" 
              : "hover:border-green-500 hover:text-green-500"
          )}
          title={isCompletedByMe 
            ? "Click to uncomplete and remove points" 
            : (isCompleted ? "Already completed by someone; click to attempt your completion" : "Click to complete and earn points")
          }
        >
          <CheckCircle2 className="h-3 w-3" />
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
                const assignees = task.assignees?.map(a => a.profile) || 
                                (task.assigned_profile ? [task.assigned_profile] : []);
                if (assignees.length > 1) {
                  if (task.completion_rule === 'any_one') {
                    return <span className="text-muted-foreground ml-1">→ first</span>;
                  } else {
                    return <span className="text-muted-foreground ml-1">→ each</span>;
                  }
                }
                return null;
              })()}
            </Badge>

            {/* Assignees Display - Hidden when completed */}
            {!isCompleted && (
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

            {/* Recurrence Indicator */}
            {(task.recurrence_options?.enabled || (task as any).isVirtual) && (
              <Badge variant="outline" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                <Repeat className="h-2 w-2" />
                {(task as any).isVirtual ? 'Series' : 'Repeats'}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};