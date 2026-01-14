import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { 
  CheckCircle2, 
  Target,
  Repeat,
  Users,
  RotateCw,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalLinkedTask } from '@/types/goal';

interface GoalTaskItemProps {
  linkedTask: GoalLinkedTask;
  onComplete?: () => void;
  onUnlink?: (linkId: string) => void;
  canEdit?: boolean;
  isCompleted?: boolean;
  isCompleting?: boolean;
  assignees?: Array<{
    id: string;
    display_name: string;
    color: string;
    avatar_url?: string | null;
  }>;
}

export function GoalTaskItem({ 
  linkedTask, 
  onComplete,
  onUnlink,
  canEdit = false,
  isCompleted = false,
  isCompleting = false,
  assignees = []
}: GoalTaskItemProps) {
  const getTaskTypeIcon = () => {
    switch (linkedTask.task_type) {
      case 'recurring':
        return <Repeat className="h-2 w-2" />;
      case 'rotating':
        return <RotateCw className="h-2 w-2" />;
      default:
        return null;
    }
  };

  const getTaskTypeBadge = () => {
    if (linkedTask.task_type === 'recurring') {
      return (
        <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
          <Repeat className="h-2 w-2" />
          Repeat
        </Badge>
      );
    }
    if (linkedTask.task_type === 'rotating') {
      return (
        <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
          <RotateCw className="h-2 w-2" />
          Rotate
        </Badge>
      );
    }
    return null;
  };

  return (
    <div 
      className={cn(
        "group/task relative rounded-lg p-3 transition-all hover:shadow-md bg-card border",
        isCompleted && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Complete Button */}
        {onComplete && (
          <Button 
            size="sm" 
            variant={isCompleted ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            disabled={isCompleting || isCompleted}
            className={cn(
              "shrink-0 w-7 h-7 p-0 cursor-pointer transition-all",
              isCompleted 
                ? "bg-green-500 hover:bg-green-600" 
                : "hover:border-green-500 hover:text-green-500",
              isCompleting && "opacity-50 cursor-wait"
            )}
            title={isCompleted ? "Completed" : "Click to complete"}
          >
            {isCompleting ? (
              <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
          </Button>
        )}

        {/* Task Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              "font-medium text-sm",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {linkedTask.task_title || 'Unknown Task'}
            </h3>

            {/* Unlink Button - visible on hover */}
            {canEdit && onUnlink && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="invisible opacity-0 group-hover/task:visible group-hover/task:opacity-100 h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(linkedTask.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Task Type Badge */}
            {getTaskTypeBadge()}

            {/* Assignees */}
            {assignees.length > 1 && (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5">
                  <Users className="h-2 w-2" />
                  Group
                </Badge>
                <div className="flex -space-x-1">
                  {assignees.slice(0, 3).map((assignee) => (
                    <UserAvatar
                      key={assignee.id}
                      name={assignee.display_name}
                      color={assignee.color}
                      avatarIcon={assignee.avatar_url || undefined}
                      size="xs"
                      className="ring-1 ring-background"
                    />
                  ))}
                  {assignees.length > 3 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      +{assignees.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
            {assignees.length === 1 && (
              <div className="flex items-center gap-1.5">
                <UserAvatar
                  name={assignees[0].display_name}
                  color={assignees[0].color}
                  avatarIcon={assignees[0].avatar_url || undefined}
                  size="xs"
                />
                <span className="text-xs text-muted-foreground">{assignees[0].display_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
