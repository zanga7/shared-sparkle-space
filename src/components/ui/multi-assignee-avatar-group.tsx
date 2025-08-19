import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MultiAssigneeAvatarGroupProps {
  assignees: Array<{
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    color?: string;
  }>;
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8', 
  lg: 'h-10 w-10'
};

export function MultiAssigneeAvatarGroup({
  assignees,
  maxDisplay = 3,
  size = 'sm',
  className
}: MultiAssigneeAvatarGroupProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (assignees.length === 0) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarFallback className="text-xs bg-muted">?</AvatarFallback>
      </Avatar>
    );
  }

  const displayedAssignees = assignees.slice(0, maxDisplay);
  const remainingCount = assignees.length - maxDisplay;

  if (assignees.length === 1) {
    const assignee = assignees[0];
    return (
      <Avatar className={cn(sizeClasses[size], className)} title={assignee.display_name}>
        <AvatarFallback className="text-xs">
          {getInitials(assignee.display_name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className={cn("flex -space-x-1", className)}>
      {displayedAssignees.map((assignee) => (
        <Avatar 
          key={assignee.id} 
          className={cn(sizeClasses[size], "border-2 border-background")}
          title={assignee.display_name}
        >
          <AvatarFallback className="text-xs">
            {getInitials(assignee.display_name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <Avatar className={cn(sizeClasses[size], "border-2 border-background")}>
          <AvatarFallback className="text-xs bg-muted" title={`+${remainingCount} more`}>
            +{remainingCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}