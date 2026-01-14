import { Target, Users, Calendar, Trophy, Pause, Play, Archive, MoreVertical, Edit, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { GoalProgressRing } from './GoalProgressRing';
import { GoalTaskItem } from './GoalTaskItem';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import type { Goal, GoalLinkedTask } from '@/types/goal';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface GoalCardProps {
  goal: Goal;
  onSelect?: (goal: Goal) => void;
  onEdit?: () => void;
  onPause?: (goalId: string) => void;
  onResume?: (goalId: string) => void;
  onArchive?: (goalId: string) => void;
  onCompleteTask?: (linkedTask: GoalLinkedTask) => void;
}

export function GoalCard({ goal, onSelect, onEdit, onPause, onResume, onArchive, onCompleteTask }: GoalCardProps) {
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

  // Group tasks by milestone for project goals
  const tasksByMilestone: Record<string, GoalLinkedTask[]> = {};
  const unassignedTasks: GoalLinkedTask[] = [];
  
  (goal.linked_tasks || []).forEach(task => {
    if (task.milestone_id) {
      if (!tasksByMilestone[task.milestone_id]) {
        tasksByMilestone[task.milestone_id] = [];
      }
      tasksByMilestone[task.milestone_id].push(task);
    } else {
      unassignedTasks.push(task);
    }
  });

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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
        
        {/* Show assignees - single or multiple */}
        {goal.assignees && goal.assignees.length > 0 && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t">
            {goal.assignees.slice(0, 5).map((a) => (
              <UserAvatar 
                key={a.profile_id}
                name={a.profile?.display_name || ''} 
                color={a.profile?.color || '#888'}
                avatarIcon={a.profile?.avatar_url || undefined}
                size="xs"
              />
            ))}
            {goal.assignees.length > 5 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{goal.assignees.length - 5}
              </span>
            )}
            {goal.assignees.length === 1 && goal.assignees[0].profile && (
              <span className="text-sm text-muted-foreground ml-1">{goal.assignees[0].profile.display_name}</span>
            )}
          </div>
        )}
        
        {/* Fallback to single assignee if no assignees array */}
        {(!goal.assignees || goal.assignees.length === 0) && goal.assignee && (
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
        
        {/* Family goals with participant progress */}
        {goal.goal_scope === 'family' && !goal.assignees?.length && progress?.participant_progress && (
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

        {/* Project Goals: Show milestones with their tasks */}
        {goal.goal_type === 'project' && goal.milestones && goal.milestones.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            {goal.milestones.slice(0, 3).map((milestone, idx) => {
              const milestoneTasks = tasksByMilestone[milestone.id] || [];
              return (
                <div key={milestone.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs',
                      milestone.is_completed 
                        ? 'bg-green-500 text-white' 
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {milestone.is_completed ? <Check className="h-3 w-3" /> : idx + 1}
                    </div>
                    <span className={cn(
                      'text-sm',
                      milestone.is_completed && 'line-through text-muted-foreground'
                    )}>
                      {milestone.title}
                    </span>
                  </div>
                  {/* Tasks under this milestone */}
                  {milestoneTasks.length > 0 && (
                    <div className="ml-7 space-y-1">
                      {milestoneTasks.slice(0, 2).map((task) => (
                        <GoalTaskItem
                          key={task.id}
                          linkedTask={task}
                          onComplete={onCompleteTask ? () => onCompleteTask(task) : undefined}
                        />
                      ))}
                      {milestoneTasks.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{milestoneTasks.length - 2} more tasks
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {goal.milestones.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{goal.milestones.length - 3} more milestones
              </span>
            )}
          </div>
        )}

        {/* Non-project goals: Show linked tasks */}
        {goal.goal_type !== 'project' && unassignedTasks.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            {unassignedTasks.slice(0, 2).map((task) => (
              <GoalTaskItem
                key={task.id}
                linkedTask={task}
                onComplete={onCompleteTask ? () => onCompleteTask(task) : undefined}
              />
            ))}
            {unassignedTasks.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{unassignedTasks.length - 2} more tasks
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
