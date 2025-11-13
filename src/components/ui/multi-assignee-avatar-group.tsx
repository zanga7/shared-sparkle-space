import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

interface MultiAssigneeAvatarGroupProps {
  assignees: Array<{
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    color?: string;
    avatar_url?: string | null;
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
      <UserAvatar 
        name="?" 
        size={size} 
        className={cn(className, "bg-muted text-muted-foreground")} 
      />
    );
  }

  const displayedAssignees = assignees.slice(0, maxDisplay);
  const remainingCount = assignees.length - maxDisplay;

  if (assignees.length === 1) {
    const assignee = assignees[0];
    return (
      <UserAvatar 
        name={assignee.display_name}
        color={assignee.color}
        avatarIcon={assignee.avatar_url || undefined}
        size={size}
        className={className}
        title={assignee.display_name}
      />
    );
  }

  return (
    <div className={cn("flex -space-x-1", className)}>
      {displayedAssignees.map((assignee) => (
        <UserAvatar
          key={assignee.id}
          name={assignee.display_name}
          color={assignee.color}
          avatarIcon={assignee.avatar_url || undefined}
          size={size}
          className="border-2 border-background"
          title={assignee.display_name}
        />
      ))}
      {remainingCount > 0 && (
        <UserAvatar
          name={`+${remainingCount}`}
          size={size}
          className="border-2 border-background bg-muted text-muted-foreground"
          title={`+${remainingCount} more`}
        />
      )}
    </div>
  );
}