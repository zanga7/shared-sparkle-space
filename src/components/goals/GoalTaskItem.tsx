import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { 
  CheckCircle, 
  Target,
  Repeat,
  Users,
  RotateCw,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalLinkedTask } from '@/types/goal';
import { useMemberColor } from '@/hooks/useMemberColor';

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
  points?: number;
  /** Hide the unlink button even when canEdit is true (for goal card display) */
  hideUnlink?: boolean;
}

export function GoalTaskItem({ 
  linkedTask, 
  onComplete,
  onUnlink,
  canEdit = false,
  isCompleted = false,
  isCompleting = false,
  assignees = [],
  points,
  hideUnlink = false
}: GoalTaskItemProps) {
  // Get member color for consistent styling with EnhancedTaskItem
  const primaryAssignee = assignees.length > 0 ? assignees[0] : null;
  const { styles: colorStyles } = useMemberColor(primaryAssignee?.color);

  const getTaskTypeBadge = () => {
    if (linkedTask.task_type === 'recurring') {
      return (
        <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5 bg-foreground/[0.08] border-0">
          <Repeat className="h-2 w-2" />
          Repeat
        </Badge>
      );
    }
    if (linkedTask.task_type === 'rotating') {
      return (
        <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5 bg-foreground/[0.08] border-0">
          <RotateCw className="h-2 w-2" />
          Rota
        </Badge>
      );
    }
    return null;
  };

  return (
    <div 
      className={cn(
        "group/task relative rounded-lg p-3 transition-all hover:shadow-md",
        isCompleted && "opacity-60"
      )}
      style={primaryAssignee ? (isCompleted ? colorStyles.bg20 : colorStyles.bg50) : { backgroundColor: 'hsl(var(--muted) / 0.3)' }}
    >
      <div className="flex items-start gap-2">
        {/* Complete Button - matches EnhancedTaskItem styling */}
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
              "shrink-0 w-10 h-10 p-0 cursor-pointer transition-all rounded-md",
              isCompleted 
                ? "bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95" 
                : "hover:border-green-500 hover:text-green-500",
              isCompleting && "opacity-50 cursor-wait"
            )}
            title={isCompleted ? "Completed" : "Click to complete and earn points"}
          >
            {isCompleting ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Task Content - matches EnhancedTaskItem layout */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              "font-medium text-sm",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {linkedTask.task_title || 'Unknown Task'}
            </h3>

            {/* Unlink Button - visible on hover, only shown in edit contexts */}
            {canEdit && onUnlink && !hideUnlink && (
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

          {/* Badges - matches EnhancedTaskItem badge row */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Points - no border, no padding */}
            {points !== undefined && (
              <span className="text-[0.72rem] h-5 flex items-center gap-1 text-muted-foreground">
                <Target className="h-2.5 w-2.5" />
                {points} pts
              </span>
            )}

            {/* Task Type Badge */}
            {getTaskTypeBadge()}

            {/* Group Badge for multiple assignees */}
            {assignees.length > 1 && (
              <Badge variant="secondary" className="text-[0.625rem] py-0 h-4 flex items-center gap-0.5 bg-foreground/[0.08] border-0">
                <Users className="h-2 w-2" />
                Group
              </Badge>
            )}

            {/* Assignees display - matches EnhancedTaskItem */}
            {!isCompleted && assignees.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                  {assignees.slice(0, 3).map((assignee) => (
                    <UserAvatar
                      key={assignee.id}
                      name={assignee.display_name}
                      color={assignee.color}
                      avatarIcon={assignee.avatar_url || undefined}
                      size="xs"
                    />
                  ))}
                </div>
                {assignees.length === 1 && (
                  <span className="text-xs text-muted-foreground">{assignees[0].display_name}</span>
                )}
                {assignees.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{assignees.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
