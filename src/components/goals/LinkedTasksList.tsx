import { Link } from 'lucide-react';
import type { GoalLinkedTask } from '@/types/goal';
import { cn } from '@/lib/utils';
import { GoalTaskItem } from './GoalTaskItem';

interface LinkedTasksListProps {
  linkedTasks: GoalLinkedTask[];
  onUnlink?: (linkId: string) => void;
  onComplete?: (linkedTask: GoalLinkedTask) => void;
  canEdit?: boolean;
  className?: string;
  showEmpty?: boolean;
}

export function LinkedTasksList({ 
  linkedTasks, 
  onUnlink, 
  onComplete,
  canEdit = false,
  className,
  showEmpty = true
}: LinkedTasksListProps) {
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
      {linkedTasks.map((link) => (
        <GoalTaskItem
          key={link.id}
          linkedTask={link}
          onUnlink={canEdit ? onUnlink : undefined}
          onComplete={onComplete ? () => onComplete(link) : undefined}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
