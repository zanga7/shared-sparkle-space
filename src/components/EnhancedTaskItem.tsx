import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    if (!task.series_id || !task.recurring_frequency || !task.due_date) return null;
    
    const dueDate = new Date(task.due_date);
    const interval = task.recurring_interval || 1;
    
    switch (task.recurring_frequency) {
      case 'daily':
        return addDays(dueDate, interval);
      case 'weekly':
        return addWeeks(dueDate, interval);
      case 'monthly':
        return addMonths(dueDate, interval);
      default:
        return null;
    }
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
        "group relative border rounded-lg p-4 transition-all hover:shadow-md",
        isCompleted && "bg-muted/30",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete Button */}
        <Button 
          size="sm" 
          variant={isCompleted ? "default" : "outline"}
          onClick={() => onToggle(task)}
          className={cn(
            "shrink-0 w-8 h-8 p-0",
            isCompleted && "bg-green-500 hover:bg-green-600"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>

        {/* Task Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title and Basic Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className={cn("font-medium", isCompleted && "line-through text-muted-foreground")}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              )}
            </div>

            {/* Action Buttons */}
            {showActions && !isCompleted && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                {onEdit && (
                  <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(task)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Badges and Indicators */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Points */}
            <Badge variant="outline" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              {task.points} pts
            </Badge>

            {/* Assigned Member */}
            {assignedProfile && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Avatar className="h-3 w-3">
                  <AvatarImage src={assignedProfile.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {assignedProfile.display_name[0]}
                  </AvatarFallback>
                </Avatar>
                {assignedProfile.display_name}
              </Badge>
            )}

            {/* Recurring Badge with Streak */}
            {task.series_id && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  Recurring
                </Badge>
                {streak > 0 && (
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                    <Flame className="h-3 w-3 mr-1" />
                    {streak} streak
                  </Badge>
                )}
              </div>
            )}

            {/* Due Date with Smart Indicators */}
            {task.due_date && (
              <Badge 
                variant={isOverdue ? "destructive" : daysUntilDue === 0 ? "default" : "outline"} 
                className="text-xs flex items-center gap-1"
              >
                {isOverdue ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {isOverdue ? 'Overdue' : 
                 daysUntilDue === 0 ? 'Due Today' :
                 daysUntilDue === 1 ? 'Due Tomorrow' :
                 format(new Date(task.due_date), "MMM d")
                }
              </Badge>
            )}

            {/* Completion Status */}
            {isCompleted && (
              <Badge variant="default" className="text-xs bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>

          {/* Series Progress (for recurring tasks) */}
          {seriesProgress && task.series_id && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Series Progress
                </span>
                <span className="text-muted-foreground">
                  Task {seriesProgress.position} • {seriesProgress.completionRate}% complete
                </span>
              </div>
              
              <Progress value={seriesProgress.completionRate} className="h-2" />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{seriesProgress.completed} of {seriesProgress.total} completed</span>
                {nextDue && !isCompleted && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Next: {format(nextDue, "MMM d")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Time-based insights */}
          {daysUntilDue !== null && !isCompleted && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysUntilDue < 0 
                ? `${Math.abs(daysUntilDue)} days overdue`
                : daysUntilDue === 0 
                ? "Due today"
                : `${daysUntilDue} days remaining`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};