import { Link } from 'lucide-react';
import type { GoalLinkedTask } from '@/types/goal';
import { cn } from '@/lib/utils';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { useGoalLinkedTasks } from '@/hooks/useGoalLinkedTasks';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkedTasksListProps {
  linkedTasks: GoalLinkedTask[];
  onUnlink?: (linkId: string) => void;
  onComplete?: (linkedTask: GoalLinkedTask) => void;
  canEdit?: boolean;
  className?: string;
  showEmpty?: boolean;
  /** Hide unlink buttons (for display-only views like detail dialog) */
  hideUnlink?: boolean;
}

export function LinkedTasksList({ 
  linkedTasks, 
  onUnlink, 
  onComplete,
  canEdit = false,
  className,
  showEmpty = true,
  hideUnlink = false
}: LinkedTasksListProps) {
  const { tasksMap, familyMembers, isLoading } = useGoalLinkedTasks(linkedTasks);

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!linkedTasks.length && showEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Link className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No tasks linked to this goal</p>
        <p className="text-xs">Link tasks to track progress automatically</p>
      </div>
    );
  }

  if (!linkedTasks.length) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {linkedTasks.map((link) => {
        const task = tasksMap[link.id];
        
        if (!task) {
          // Fallback for tasks that couldn't be loaded
          return (
            <div 
              key={link.id}
              className="rounded-lg p-3 bg-muted/30 text-muted-foreground text-sm"
            >
              {link.task_title || 'Unknown Task'}
            </div>
          );
        }

        return (
          <EnhancedTaskItem
            key={link.id}
            task={task}
            allTasks={Object.values(tasksMap)}
            familyMembers={familyMembers}
            onToggle={() => onComplete?.(link)}
            showActions={canEdit && !hideUnlink}
            onDelete={canEdit && !hideUnlink && onUnlink ? () => onUnlink(link.id) : undefined}
          />
        );
      })}
    </div>
  );
}
