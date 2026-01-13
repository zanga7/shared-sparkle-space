import { Target, Users, Calendar, Trophy, Pause, Play, Archive, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { GoalProgressRing } from './GoalProgressRing';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import type { Goal } from '@/types/goal';
import { format, differenceInDays } from 'date-fns';

interface GoalCardProps {
  goal: Goal;
  onSelect?: (goal: Goal) => void;
  onPause?: (goalId: string) => void;
  onResume?: (goalId: string) => void;
  onArchive?: (goalId: string) => void;
}

export function GoalCard({ goal, onSelect, onPause, onResume, onArchive }: GoalCardProps) {
  const progress = goal.progress;
  const percent = progress?.current_percent ?? 0;
  
  const getGoalTypeLabel = () => {
    switch (goal.goal_type) {
      case 'consistency': return 'Consistency';
      case 'target_count': return 'Target';
      case 'project': return 'Project';
      default: return goal.goal_type;
    }
  };

  const getStatusBadge = () => {
    if (goal.status === 'completed') {
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    }
    if (goal.status === 'paused') {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (goal.status === 'archived') {
      return <Badge variant="outline">Archived</Badge>;
    }
    if (progress?.goal_type === 'consistency' && 'on_track' in progress) {
      return progress.on_track 
        ? <Badge variant="default" className="bg-green-500">On Track</Badge>
        : <Badge variant="destructive">At Risk</Badge>;
    }
    return null;
  };

  const getProgressDetails = () => {
    if (!progress) return null;
    
    if (progress.goal_type === 'consistency' && 'grace_remaining' in progress) {
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Completed</span>
            <span className="font-medium">{progress.total_completions} / {progress.expected_completions}</span>
          </div>
          <div className="flex justify-between">
            <span>Grace days left</span>
            <span className="font-medium">{progress.grace_remaining}</span>
          </div>
        </div>
      );
    }
    
    if (progress.goal_type === 'target_count' && 'current_count' in progress) {
      return (
        <div className="text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Progress</span>
            <span className="font-medium">{progress.current_count} / {progress.target_count}</span>
          </div>
        </div>
      );
    }
    
    if (progress.goal_type === 'project' && 'completed_milestones' in progress) {
      return (
        <div className="text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Milestones</span>
            <span className="font-medium">{progress.completed_milestones} / {progress.total_milestones}</span>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const getDaysRemaining = () => {
    if (!goal.end_date) return null;
    const days = differenceInDays(new Date(goal.end_date), new Date());
    if (days < 0) return 'Ended';
    if (days === 0) return 'Ends today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onSelect?.(goal)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              {goal.goal_scope === 'family' ? (
                <Users className="h-4 w-4 text-primary" />
              ) : (
                <Target className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">{goal.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {getGoalTypeLabel()}
                </Badge>
                {getStatusBadge()}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {goal.status === 'active' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPause?.(goal.id); }}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}
              {goal.status === 'paused' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResume?.(goal.id); }}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </DropdownMenuItem>
              )}
              {goal.status !== 'archived' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive?.(goal.id); }}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="flex items-center gap-4">
          <GoalProgressRing percent={percent} size="md" />
          
          <div className="flex-1 min-w-0 space-y-2">
            {getProgressDetails()}
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {goal.end_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{getDaysRemaining()}</span>
                </div>
              )}
              
              {goal.reward && (
                <div className="flex items-center gap-1 text-amber-500">
                  <Trophy className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[100px]">{goal.reward.title}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {goal.goal_scope === 'individual' && goal.assignee && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <UserAvatar 
              name={goal.assignee.display_name} 
              color={goal.assignee.color}
              avatarIcon={goal.assignee.avatar_url || undefined}
              size="xs"
            />
            <span className="text-sm text-muted-foreground">{goal.assignee.display_name}</span>
          </div>
        )}
        
        {goal.goal_scope === 'family' && progress?.participant_progress && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t">
            {progress.participant_progress.slice(0, 5).map((p) => (
              <UserAvatar 
                key={p.profile_id}
                name={p.display_name} 
                color={p.color}
                size="xs"
              />
            ))}
            {progress.participant_progress.length > 5 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{progress.participant_progress.length - 5}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
