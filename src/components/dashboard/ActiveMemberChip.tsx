import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { User } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  color: string;
  role: 'parent' | 'child';
}

interface ActiveMemberChipProps {
  activeMember: Profile | null;
  className?: string;
}

export function ActiveMemberChip({ activeMember, className }: ActiveMemberChipProps) {
  if (!activeMember) {
    return (
      <Badge variant="outline" className={`h-9 px-3 ${className}`}>
        <User className="mr-2 h-4 w-4" />
        No Active Member
      </Badge>
    );
  }

  return (
    <Badge 
      variant="default" 
      className={`h-9 px-3 bg-primary text-primary-foreground ${className}`}
    >
      <UserAvatar 
        name={activeMember.display_name} 
        color={activeMember.color} 
        size="sm" 
        className="mr-2" 
      />
      Acting as {activeMember.display_name}
    </Badge>
  );
}