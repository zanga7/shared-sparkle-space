import { UserAvatar } from '@/components/ui/user-avatar';
import { Progress } from '@/components/ui/progress';
import type { ParticipantProgress } from '@/types/goal';
import { cn } from '@/lib/utils';

interface ParticipantContributionsProps {
  participants: ParticipantProgress[];
  className?: string;
}

export function ParticipantContributions({ 
  participants, 
  className 
}: ParticipantContributionsProps) {
  if (!participants.length) {
    return null;
  }

  const maxCompletions = Math.max(...participants.map(p => p.completions), 1);
  const totalCompletions = participants.reduce((sum, p) => sum + p.completions, 0);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Team Contributions</span>
        <span className="text-muted-foreground">{totalCompletions} total</span>
      </div>
      
      {participants.map((participant) => {
        const contributionPercent = totalCompletions > 0 
          ? (participant.completions / totalCompletions) * 100 
          : 0;
        
        return (
          <div key={participant.profile_id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserAvatar 
                  name={participant.display_name}
                  color={participant.color}
                  size="xs"
                />
                <span className="text-sm font-medium">{participant.display_name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {participant.completions} ({Math.round(contributionPercent)}%)
              </span>
            </div>
            <Progress 
              value={contributionPercent} 
              className="h-2"
              style={{ 
                // Use participant color for the progress bar
                ['--progress-color' as string]: participant.color 
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
