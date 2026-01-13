import { CheckSquare, Repeat, RotateCcw, X, Link } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GoalLinkedTask } from '@/types/goal';
import { cn } from '@/lib/utils';

interface LinkedTasksListProps {
  linkedTasks: GoalLinkedTask[];
  onUnlink?: (linkId: string) => void;
  canEdit?: boolean;
  className?: string;
}

export function LinkedTasksList({ 
  linkedTasks, 
  onUnlink, 
  canEdit = false,
  className 
}: LinkedTasksListProps) {
  if (!linkedTasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Link className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No tasks linked to this goal</p>
        <p className="text-xs">Link tasks to track progress automatically</p>
      </div>
    );
  }

  const getTaskIcon = (type?: string) => {
    switch (type) {
      case 'recurring':
        return <Repeat className="h-4 w-4 text-blue-500" />;
      case 'rotating':
        return <RotateCcw className="h-4 w-4 text-purple-500" />;
      default:
        return <CheckSquare className="h-4 w-4 text-primary" />;
    }
  };

  const getTaskTypeBadge = (type?: string) => {
    switch (type) {
      case 'recurring':
        return <Badge variant="outline" className="text-xs">Recurring</Badge>;
      case 'rotating':
        return <Badge variant="outline" className="text-xs">Rotating</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">One-off</Badge>;
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {linkedTasks.map((link) => (
        <div 
          key={link.id}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
        >
          {getTaskIcon(link.task_type)}
          
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {link.task_title || 'Unknown Task'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {getTaskTypeBadge(link.task_type)}
              <span className="text-xs text-muted-foreground">
                Linked {new Date(link.linked_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {canEdit && onUnlink && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onUnlink(link.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
