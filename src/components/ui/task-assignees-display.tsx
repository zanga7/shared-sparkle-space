import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/types/task';
import { cn } from '@/lib/utils';

interface TaskAssigneesDisplayProps {
  task: Task;
  className?: string;
  showNames?: boolean;
  maxDisplay?: number;
  onClick?: () => void;
}

export function TaskAssigneesDisplay({ 
  task, 
  className,
  showNames = false,
  maxDisplay = 3,
  onClick
}: TaskAssigneesDisplayProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get assignees from both new and old format
  const assignees = task.assignees?.map(a => a.profile) || 
                   (task.assigned_profile ? [task.assigned_profile] : []);

  if (assignees.length === 0) {
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs cursor-pointer hover:bg-muted", className)}
        onClick={onClick}
      >
        Anyone
      </Badge>
    );
  }

  const displayedAssignees = assignees.slice(0, maxDisplay);
  const remainingCount = assignees.length - maxDisplay;

  if (showNames && assignees.length === 1) {
    return (
      <div 
        className={cn("flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-1 -m-1", className)}
        onClick={onClick}
      >
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">
            {getInitials(assignees[0].display_name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{assignees[0].display_name}</span>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer hover:bg-muted rounded p-1 -m-1", className)}
      onClick={onClick}
    >
      <div className="flex -space-x-1">
        {displayedAssignees.map((assignee) => (
          <Avatar 
            key={assignee.id} 
            className="h-6 w-6 border-2 border-background"
            title={assignee.display_name}
          >
            <AvatarFallback className="text-xs">
              {getInitials(assignee.display_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <Avatar className="h-6 w-6 border-2 border-background">
            <AvatarFallback className="text-xs bg-muted">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {showNames && assignees.length > 1 && (
        <span className="text-sm text-muted-foreground ml-2">
          {assignees.length} people
        </span>
      )}
    </div>
  );
}