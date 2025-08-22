import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EventAttendeesDisplayProps {
  attendees: Array<{
    profile: {
      id: string;
      display_name: string;
      color?: string;
    };
  }>;
  className?: string;
  showNames?: boolean;
  maxDisplay?: number;
  onClick?: () => void;
}

export function EventAttendeesDisplay({ 
  attendees = [], 
  className,
  showNames = false,
  maxDisplay = 3,
  onClick
}: EventAttendeesDisplayProps) {
  if (attendees.length === 0) {
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs cursor-pointer hover:bg-muted", className)}
        onClick={onClick}
      >
        Click to assign
      </Badge>
    );
  }

  const displayedAttendees = attendees.slice(0, maxDisplay);
  const remainingCount = attendees.length - maxDisplay;

  if (showNames && attendees.length === 1) {
    return (
      <div 
        className={cn("flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-1 -m-1", className)}
        onClick={onClick}
      >
        <UserAvatar
          name={attendees[0].profile.display_name}
          color={attendees[0].profile.color || 'sky'}
          size="sm"
        />
        <span className="text-sm">{attendees[0].profile.display_name}</span>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer hover:bg-muted rounded p-1 -m-1", className)}
      onClick={onClick}
    >
      <div className="flex -space-x-1">
        {displayedAttendees.map((attendee) => (
          <UserAvatar
            key={attendee.profile.id}
            name={attendee.profile.display_name}
            color={attendee.profile.color || 'sky'}
            size="sm"
            className="border-2 border-background"
            title={attendee.profile.display_name}
          />
        ))}
        {remainingCount > 0 && (
          <UserAvatar
            name={`+${remainingCount}`}
            size="sm"
            className="border-2 border-background bg-muted text-muted-foreground"
            title={`+${remainingCount} more`}
          />
        )}
      </div>
      {showNames && attendees.length > 1 && (
        <span className="text-sm text-muted-foreground ml-2">
          {attendees.length} people
        </span>
      )}
    </div>
  );
}