import { Check, Circle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { GoalMilestone } from '@/types/goal';

interface MilestoneListProps {
  milestones: GoalMilestone[];
  onComplete?: (milestoneId: string) => void;
  canComplete?: boolean;
  className?: string;
}

export function MilestoneList({ 
  milestones, 
  onComplete, 
  canComplete = false,
  className 
}: MilestoneListProps) {
  if (!milestones.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No milestones defined
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {milestones.map((milestone, index) => (
        <div 
          key={milestone.id}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border transition-colors',
            milestone.is_completed 
              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
              : 'bg-card border-border'
          )}
        >
          <div className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            milestone.is_completed 
              ? 'bg-green-500 text-white' 
              : 'bg-muted text-muted-foreground'
          )}>
            {milestone.is_completed ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="text-sm font-medium">{index + 1}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={cn(
              'font-medium',
              milestone.is_completed && 'line-through text-muted-foreground'
            )}>
              {milestone.title}
            </div>
            {milestone.reward && (
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-500">
                <Trophy className="h-3 w-3" />
                <span>{milestone.reward.title}</span>
              </div>
            )}
          </div>
          
          {!milestone.is_completed && canComplete && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onComplete?.(milestone.id)}
            >
              Complete
            </Button>
          )}
          
          {milestone.is_completed && milestone.completed_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(milestone.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
