import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/ui/user-avatar';
import { 
  CheckCircle2, 
  Clock, 
  Flame, 
  TrendingUp, 
  Calendar, 
  Repeat,
  Edit,
  Trash2,
  AlertTriangle,
  Target
} from 'lucide-react';
import { format, isAfter, differenceInDays, addDays, addWeeks, addMonths } from 'date-fns';
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
}

export const EnhancedTaskItem = ({ 
  task, 
  allTasks, 
  familyMembers, 
  onToggle, 
  onEdit, 
  onDelete,
  showActions = true 
}: EnhancedTaskItemProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const isCompleted = task.task_completions && task.task_completions.length > 0;
  const isOverdue = task.due_date && isAfter(new Date(), new Date(task.due_date)) && !isCompleted;
  const assignedProfile = familyMembers.find(member => member.id === task.assigned_to);

  // Calculate streak for recurring tasks
  const calculateStreak = () => {
    if (!task.series_id) return 0;
    
    const seriesTasks = allTasks
      .filter(t => t.series_id === task.series_id && t.due_date)
      .sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime());
    
    let streak = 0;
    for (const t of seriesTasks) {
      const isTaskCompleted = t.task_completions && t.task_completions.length > 0;
      const isDue = new Date(t.due_date!) <= new Date();
      
      if (isTaskCompleted) {
        streak++;
      } else if (isDue) {
        break;
      }
    }
    return streak;
  };

  // Calculate series progress
  const calculateSeriesProgress = () => {
    if (!task.series_id) return null;
    
    const seriesTasks = allTasks.filter(t => t.series_id === task.series_id);
    const completedTasks = seriesTasks.filter(t => t.task_completions?.length);
    
    // Find current position in series
    const sortedTasks = seriesTasks
      .filter(t => t.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    
    const currentIndex = sortedTasks.findIndex(t => t.id === task.id);
    
    return {
      completed: completedTasks.length,
      total: seriesTasks.length,
      position: currentIndex + 1,
      completionRate: seriesTasks.length > 0 ? Math.round((completedTasks.length / seriesTasks.length) * 100) : 0
    };
  };

  // Calculate next due date for recurring tasks  
  const calculateNextDue = () => {
    if (!task.series_id || !task.due_date) return null;
    
    // For recurring tasks, we can't calculate next due date from task alone
    // since recurring fields are now in task_series table
    return null;
  };

  // Get days until due
  const getDaysUntilDue = () => {
    if (!task.due_date) return null;
    const days = differenceInDays(new Date(task.due_date), new Date());
    return days;
  };

  const streak = calculateStreak();
  const seriesProgress = calculateSeriesProgress();
  const nextDue = calculateNextDue();
  const daysUntilDue = getDaysUntilDue();

  return (
    <div 
      className={cn(
        "group relative border rounded-lg p-3 transition-all hover:shadow-md cursor-pointer",
        isCompleted && "bg-muted/30",
        isOverdue && "border-destructive/50 bg-destructive/5",
        onEdit && "hover:bg-muted/20"
      )}
      onClick={onEdit ? (e) => {
        // Don't trigger if clicking on buttons, interactive elements, or drag handle
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[data-drag-handle]')) return;
        onEdit(task);
      } : undefined}
    >
      <div className="flex items-start gap-2">
        {/* Complete Button */}
        <Button 
          size="sm" 
          variant={isCompleted ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task);
          }}
          className={cn(
            "shrink-0 w-7 h-7 p-0",
            isCompleted && "bg-green-500 hover:bg-green-600"
          )}
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

            {/* Assignees Display */}
            <TaskAssigneesDisplay 
              task={task} 
              showNames={false}
              onClick={onEdit ? () => onEdit(task) : undefined}
            />

            {/* Recurring Badge */}
            {task.series_id && (
              <Badge variant="outline" className="text-xs py-0 h-5 flex items-center gap-1">
                <Repeat className="h-2.5 w-2.5" />
                {streak > 0 ? `${streak}🔥` : 'Recurring'}
              </Badge>
            )}

            {/* Due Date */}
            {task.due_date && (
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

            {/* Completion Status */}
            {isCompleted && (
              <Badge variant="default" className="text-xs py-0 h-5 bg-green-500">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                {(() => {
                  if (task.completion_rule === 'any_one' && task.task_completions?.length) {
                    // Show who completed it for "any_one" tasks
                    const completion = task.task_completions[0];
                    const completer = familyMembers.find(m => m.id === completion.completed_by);
                    return `Completed by ${completer?.display_name || 'someone'}`;
                  }
                  return 'Done';
                })()}
              </Badge>
            )}
          </div>

          {/* Compact Series Progress */}
          {seriesProgress && task.series_id && seriesProgress.total > 1 && (
            <div className="space-y-1 p-2 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Progress
                </span>
                <span className="text-muted-foreground">
                  {seriesProgress.completed}/{seriesProgress.total} ({seriesProgress.completionRate}%)
                </span>
              </div>
              <Progress value={seriesProgress.completionRate} className="h-1.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};