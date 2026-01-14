import { useEffect, useRef } from 'react';
import { Check, Trophy, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GoalMilestone, GoalLinkedTask } from '@/types/goal';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { useGoalLinkedTasks } from '@/hooks/useGoalLinkedTasks';
import { Skeleton } from '@/components/ui/skeleton';

interface MilestoneListProps {
  milestones: GoalMilestone[];
  linkedTasks?: GoalLinkedTask[];
  onComplete?: (milestoneId: string) => void;
  onCompleteTask?: (linkedTask: GoalLinkedTask) => void;
  onUnlinkTask?: (linkId: string) => void;
  canComplete?: boolean;
  canEdit?: boolean;
  className?: string;
}

export function MilestoneList({ 
  milestones, 
  linkedTasks = [],
  onComplete,
  onCompleteTask,
  onUnlinkTask,
  canComplete = false,
  canEdit = false,
  className 
}: MilestoneListProps) {
  const { tasksMap, familyMembers, isLoading } = useGoalLinkedTasks(linkedTasks);
  
  // Track which milestones we've auto-completed to prevent duplicate calls
  const autoCompletedRef = useRef<Set<string>>(new Set());

  // Group tasks by milestone_id
  const tasksByMilestone: Record<string, GoalLinkedTask[]> = {};
  linkedTasks.forEach(task => {
    const milestoneId = task.milestone_id || 'unassigned';
    if (!tasksByMilestone[milestoneId]) {
      tasksByMilestone[milestoneId] = [];
    }
    tasksByMilestone[milestoneId].push(task);
  });

  // Check if all tasks in a milestone are completed
  const areAllTasksCompleted = (milestoneId: string): boolean => {
    const milestoneTasks = tasksByMilestone[milestoneId] || [];
    if (milestoneTasks.length === 0) return false; // No tasks = not completable
    
    return milestoneTasks.every(linkedTask => {
      const task = tasksMap[linkedTask.id];
      if (!task) return false;
      
      // Check if task has any completions
      const hasCompletions = task.task_completions && task.task_completions.length > 0;
      return hasCompletions;
    });
  };

  // Get completion progress for a milestone
  const getTaskProgress = (milestoneId: string): { completed: number; total: number } => {
    const milestoneTasks = tasksByMilestone[milestoneId] || [];
    const total = milestoneTasks.length;
    const completed = milestoneTasks.filter(linkedTask => {
      const task = tasksMap[linkedTask.id];
      return task?.task_completions && task.task_completions.length > 0;
    }).length;
    return { completed, total };
  };

  // Auto-complete milestones when all tasks are done
  useEffect(() => {
    if (isLoading || !onComplete) return;
    
    milestones.forEach(milestone => {
      if (milestone.is_completed) return;
      if (autoCompletedRef.current.has(milestone.id)) return;
      
      const milestoneTasks = tasksByMilestone[milestone.id] || [];
      if (milestoneTasks.length === 0) return;
      
      if (areAllTasksCompleted(milestone.id)) {
        autoCompletedRef.current.add(milestone.id);
        onComplete(milestone.id);
      }
    });
  }, [milestones, tasksMap, isLoading, onComplete]);

  if (!milestones.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No milestones defined
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {milestones.map((milestone, index) => {
        const milestoneTasks = tasksByMilestone[milestone.id] || [];
        const allTasksCompleted = areAllTasksCompleted(milestone.id);
        const { completed, total } = getTaskProgress(milestone.id);
        const hasTasks = total > 0;
        
        return (
          <div 
            key={milestone.id}
            className={cn(
              'rounded-lg border transition-colors',
              milestone.is_completed 
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                : 'bg-card border-border'
            )}
          >
            {/* Milestone Header */}
            <div className="flex items-center gap-3 p-3">
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                milestone.is_completed 
                  ? 'bg-green-500 text-white' 
                  : 'bg-muted text-muted-foreground'
              )}>
                {milestone.is_completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'font-medium',
                  milestone.is_completed && 'line-through text-muted-foreground'
                )}>
                  {milestone.title}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {milestone.reward && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Trophy className="h-3 w-3" />
                      <span>{milestone.reward.title}</span>
                    </div>
                  )}
                  {/* Task progress indicator */}
                  {!milestone.is_completed && hasTasks && (
                    <Badge variant={allTasksCompleted ? "default" : "secondary"} className="text-xs py-0 h-5">
                      {completed}/{total} tasks
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Show locked state if tasks aren't all complete */}
              {!milestone.is_completed && canComplete && hasTasks && !allTasksCompleted && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Complete all tasks</span>
                </div>
              )}
              
              {/* Show complete button only when all tasks are done (auto-completes, but show for manual trigger) */}
              {!milestone.is_completed && canComplete && (!hasTasks || allTasksCompleted) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onComplete?.(milestone.id)}
                  className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              )}
              
              {milestone.is_completed && milestone.completed_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(milestone.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Tasks under this milestone */}
            {milestoneTasks.length > 0 && (
              <div className="px-3 pb-3 pt-0 space-y-2 ml-11">
                {isLoading ? (
                  <Skeleton className="h-12 w-full rounded-lg" />
                ) : (
                  milestoneTasks.map((linkedTask) => {
                    const task = tasksMap[linkedTask.id];
                    
                    if (!task) {
                      return (
                        <div 
                          key={linkedTask.id}
                          className="rounded-lg p-3 bg-muted/30 text-muted-foreground text-sm"
                        >
                          {linkedTask.task_title || 'Unknown Task'}
                        </div>
                      );
                    }

                    return (
                      <EnhancedTaskItem
                        key={linkedTask.id}
                        task={task}
                        allTasks={Object.values(tasksMap)}
                        familyMembers={familyMembers}
                        onToggle={() => onCompleteTask?.(linkedTask)}
                        showActions={canEdit}
                        onDelete={canEdit && onUnlinkTask ? () => onUnlinkTask(linkedTask.id) : undefined}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
