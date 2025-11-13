import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

interface OverlappingAvatarGroupProps {
  members: Array<{
    id: string;
    display_name: string;
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

const gapClasses = {
  sm: 'gap-1',
  md: 'gap-1',
  lg: 'gap-2'
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
        avatarIcon={member.avatar_url || undefined}
        size={size}
        className={className}
        title={member.display_name}
      />
    );
  }

  return (
    <div className={cn("flex", gapClasses[size], className)}>
      {displayedMembers.map((member) => (
        <UserAvatar
          key={member.id}
          name={member.display_name}
          color={member.color}
          avatarIcon={member.avatar_url || undefined}
          size={size}
          title={member.display_name}
        />
      ))}
      {remainingCount > 0 && (
        <UserAvatar
          name={`+${remainingCount}`}
          size={size}
          className="bg-muted text-muted-foreground"
          title={`+${remainingCount} more`}
        />
      )}
    </div>
  );
}