import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

interface OverlappingAvatarGroupProps {
  members: Array<{
    id: string;
    display_name: string;
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

const overlapClasses = {
  sm: '-space-x-1',
  md: '-space-x-2',
  lg: '-space-x-3'
};

export function OverlappingAvatarGroup({
  members,
  maxDisplay = 3,
  size = 'md',
  className
}: OverlappingAvatarGroupProps) {
  if (members.length === 0) {
    return null;
  }

  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;

  if (members.length === 1) {
    const member = members[0];
    return (
      <UserAvatar 
        name={member.display_name}
        color={member.color}
        size={size}
        className={className}
        title={member.display_name}
      />
    );
  }

  return (
    <div className={cn("flex", overlapClasses[size], className)}>
      {displayedMembers.map((member, index) => (
        <UserAvatar
          key={member.id}
          name={member.display_name}
          color={member.color}
          size={size}
          className={cn(
            "border-2 border-background",
            index > 0 && "shadow-sm" // Add shadow to overlapped avatars for better visibility
          )}
          title={member.display_name}
        />
      ))}
      {remainingCount > 0 && (
        <UserAvatar
          name={`+${remainingCount}`}
          size={size}
          className="border-2 border-background bg-muted text-muted-foreground shadow-sm"
          title={`+${remainingCount} more`}
        />
      )}
    </div>
  );
}