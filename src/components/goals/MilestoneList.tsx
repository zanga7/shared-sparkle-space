import { Check, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

  if (!milestones.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No milestones defined
      </div>
    );
  }

  // Group tasks by milestone_id
  const tasksByMilestone: Record<string, GoalLinkedTask[]> = {};
  linkedTasks.forEach(task => {
    const milestoneId = task.milestone_id || 'unassigned';
    if (!tasksByMilestone[milestoneId]) {
      tasksByMilestone[milestoneId] = [];
    }
    tasksByMilestone[milestoneId].push(task);
  });

  return (
    <div className={cn('space-y-3', className)}>
      {milestones.map((milestone, index) => {
        const milestoneTasks = tasksByMilestone[milestone.id] || [];
        
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
                {milestone.reward && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                    <Trophy className="h-3 w-3" />
                    <span>{milestone.reward.title}</span>
                  </div>
                )}
              </div>
              
              {!milestone.is_completed && canComplete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onComplete?.(milestone.id)}
                >
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
