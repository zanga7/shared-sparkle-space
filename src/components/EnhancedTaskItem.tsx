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
import { cn } from '@/lib/utils';
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
}

export const EnhancedTaskItem = ({ 
  task, 
  allTasks, 
  familyMembers, 
  onToggle, 
  onEdit, 
  onDelete,
  showActions = true,
  currentMemberId
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

  return (
    <div 
      className={cn(
        "group relative border rounded-lg p-3 transition-all hover:shadow-md",
        isCompleted && "bg-muted/30",
        isOverdue && "border-destructive/50 bg-destructive/5"
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

            {/* Action Buttons */}
            {showActions && !isCompleted && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                {onEdit && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(task);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Compact Badges and Indicators */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Points with Award Info */}
            <Badge variant="outline" className="text-xs py-0 h-5 flex items-center gap-1">
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
                className="text-xs py-0 h-5 flex items-center gap-1"
              >
                {isOverdue ? (
                  <AlertTriangle className="h-2.5 w-2.5" />
                ) : (
                  <Calendar className="h-2.5 w-2.5" />
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
              <Badge variant="outline" className="text-xs py-0 h-5 flex items-center gap-1">
                <Repeat className="h-2.5 w-2.5" />
                {(task as any).isVirtual ? 'Series' : 'Repeats'}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};