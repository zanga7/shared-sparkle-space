import { Target, Users, Calendar, Trophy, Pause, Play, Archive, MoreVertical, Edit, Check, Flame, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { GoalProgressRing } from './GoalProgressRing';
import { ConsistencyProgressGrid } from './ConsistencyProgressGrid';
import { TargetProgressGrid } from './TargetProgressGrid';
import { useConsistencyCompletions } from '@/hooks/useConsistencyCompletions';
import { useTargetCompletions } from '@/hooks/useTargetCompletions';
import { useGoalLinkedTasks } from '@/hooks/useGoalLinkedTasks';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
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
  onCompleteTask?: (linkedTask: GoalLinkedTask, task?: any) => void;
}

export function GoalCard({ goal, onSelect, onEdit, onPause, onResume, onArchive, onCompleteTask }: GoalCardProps) {
  const progress = goal.progress;
  const percent = progress?.current_percent ?? 0;
  
  // Fetch completion dates for consistency goals - now by member
  const { completionsByMember, allCompletedDates } = useConsistencyCompletions(
    goal.goal_type === 'consistency' ? goal : null
  );
  
  // Fetch completion counts for target goals - by member
  const { completionsByMember: targetCompletionsByMember, totalCompletions: targetTotalCompletions } = useTargetCompletions(
    goal.goal_type === 'target_count' ? goal : null
  );
  
  // Fetch full task data for linked tasks
  const { tasksMap, familyMembers } = useGoalLinkedTasks(goal.linked_tasks || []);
  
  // Get goal assignees with their profile data
  const goalAssignees = goal.assignees || [];
  const assigneeProfiles = goalAssignees.map(a => a.profile).filter(Boolean);
  
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
    
    if (progress.goal_type === 'project') {
      const completedTasks = (progress as any).completed_tasks ?? 0;
      const totalTasks = (progress as any).total_tasks ?? 0;
      
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Tasks</span>
            <span className="font-medium">{completedTasks} / {totalTasks}</span>
          </div>
          {'completed_milestones' in progress && progress.total_milestones > 0 && (
            <div className="flex justify-between text-xs">
              <span>Milestones</span>
              <span>{progress.completed_milestones} / {progress.total_milestones}</span>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const getDaysRemaining = () => {
    // For consistency goals, calculate based on time_window_days from start
    if (goal.goal_type === 'consistency' && 'time_window_days' in goal.success_criteria) {
      const startDate = new Date(goal.start_date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysElapsed = differenceInDays(today, startDate);
      const totalDays = (goal.success_criteria as { time_window_days: number }).time_window_days;
      const remaining = totalDays - daysElapsed;
      
      if (remaining < 0) return goal.status === 'completed' ? 'Completed' : 'Ended';
      if (remaining === 0) return 'Last day';
      if (remaining === 1) return '1 day left';
      return `${remaining} days left`;
    }
    
    if (!goal.end_date) return null;
    const endDate = new Date(goal.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = differenceInDays(endDate, today);
    if (days < 0) return goal.status === 'completed' ? 'Completed' : 'Ended';
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
        {/* Consistency goals show per-member streak grids */}
        {goal.goal_type === 'consistency' && 'time_window_days' in goal.success_criteria ? (
          <div className="space-y-3">
            {/* Streak info header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">
                  {progress && 'total_completions' in progress ? progress.total_completions : 0} / {(goal.success_criteria as { time_window_days: number }).time_window_days} days
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">{getDaysRemaining()}</span>
              </div>
            </div>
            
            {/* Per-member compact streak grids */}
            <div className="space-y-2">
              {assigneeProfiles.length > 0 ? (
                assigneeProfiles.map((profile) => {
                  const memberCompletions = completionsByMember[profile!.id] || [];
                  return (
                    <div key={profile!.id} className="flex items-start gap-2">
                      <UserAvatar 
                        name={profile!.display_name} 
                        color={profile!.color}
                        avatarIcon={profile!.avatar_url || undefined}
                        size="xs"
                        className="mt-0.5 shrink-0"
                      />
                      <ConsistencyProgressGrid
                        startDate={goal.start_date}
                        totalDays={(goal.success_criteria as { time_window_days: number }).time_window_days}
                        completedDates={memberCompletions}
                        memberColor={profile!.color}
                        className="text-xs flex-1"
                      />
                    </div>
                  );
                })
              ) : (
                /* Fallback: single grid if no assignees */
                <ConsistencyProgressGrid
                  startDate={goal.start_date}
                  totalDays={(goal.success_criteria as { time_window_days: number }).time_window_days}
                  completedDates={allCompletedDates}
                  className="text-xs"
                />
              )}
            </div>
            
            {goal.reward && (
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                <Trophy className="h-3.5 w-3.5" />
                <span className="truncate">{goal.reward.title}</span>
              </div>
            )}
          </div>
        ) : goal.goal_type === 'target_count' && 'target_count' in goal.success_criteria ? (
          <div className="space-y-3">
            {/* Target info header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  {targetTotalCompletions} / {(goal.success_criteria as { target_count: number }).target_count} completed
                </span>
              </div>
              {goal.end_date && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">{getDaysRemaining()}</span>
                </div>
              )}
            </div>
            
            {/* Per-member sequential progress grids */}
            <div className="space-y-2">
              {assigneeProfiles.length > 0 ? (
                assigneeProfiles.map((profile) => {
                  const memberCount = targetCompletionsByMember[profile!.id] || 0;
                  return (
                    <div key={profile!.id} className="flex items-start gap-2">
                      <UserAvatar 
                        name={profile!.display_name} 
                        color={profile!.color}
                        avatarIcon={profile!.avatar_url || undefined}
                        size="xs"
                        className="mt-0.5 shrink-0"
                      />
                      <TargetProgressGrid
                        targetCount={(goal.success_criteria as { target_count: number }).target_count}
                        completedCount={memberCount}
                        memberColor={profile!.color}
                        className="text-xs flex-1"
                      />
                    </div>
                  );
                })
              ) : (
                <TargetProgressGrid
                  targetCount={(goal.success_criteria as { target_count: number }).target_count}
                  completedCount={targetTotalCompletions}
                  className="text-xs"
                />
              )}
            </div>
            
            {goal.reward && (
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                <Trophy className="h-3.5 w-3.5" />
                <span className="truncate">{goal.reward.title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <GoalProgressRing percent={percent} size="md" />
              
              <div className="flex-1 min-w-0 space-y-2">
                {getProgressDetails()}
                
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {goal.end_date && (
                    <>
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{getDaysRemaining()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {goal.reward && (
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                <Trophy className="h-3.5 w-3.5" />
                <span className="truncate">{goal.reward.title}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Show assignees - single or multiple (skip for consistency/target goals - avatars are in grids) */}
        {goal.goal_type !== 'consistency' && goal.goal_type !== 'target_count' && goal.assignees && goal.assignees.length > 0 && (
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
        
        {/* Fallback to single assignee if no assignees array (skip for consistency/target) */}
        {goal.goal_type !== 'consistency' && goal.goal_type !== 'target_count' && (!goal.assignees || goal.assignees.length === 0) && goal.assignee && (
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
        
        {/* Family goals with participant progress (skip for consistency/target) */}
        {goal.goal_type !== 'consistency' && goal.goal_type !== 'target_count' && goal.goal_scope === 'family' && !goal.assignees?.length && progress?.participant_progress && (
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

        {/* Close the ternary for non-consistency goals */}

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
                      {milestoneTasks.slice(0, 2).map((linkedTask) => {
                        const task = tasksMap[linkedTask.id];
                        if (!task) {
                          return (
                            <div key={linkedTask.id} className="rounded-lg p-2 bg-muted/30 text-muted-foreground text-xs">
                              {linkedTask.task_title || 'Unknown Task'}
                            </div>
                          );
                        }
                        return (
                          <EnhancedTaskItem
                            key={linkedTask.id}
                            task={task}
                            allTasks={Object.values(tasksMap)}
                            familyMembers={familyMembers}
                            onToggle={() => onCompleteTask?.(linkedTask, task)}
                            showActions={false}
                          />
                        );
                      })}
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

        {/* Non-project goals: Show linked tasks (hidden when completed) */}
        {goal.status !== 'completed' && goal.goal_type !== 'project' && unassignedTasks.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
            {/* Show "Complete today's challenge" header for consistency goals */}
            {goal.goal_type === 'consistency' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Complete today's challenge</span>
              </div>
            )}
            {/* For consistency goals, render per-member tasks */}
            {goal.goal_type === 'consistency' ? (
              <>
                {unassignedTasks.slice(0, 1).map((linkedTask) => {
                  // Get all tasks for this series (one per member)
                  const seriesTasks = Object.entries(tasksMap)
                    .filter(([key]) => key.startsWith(`${linkedTask.id}-`) || key === linkedTask.id)
                    .map(([key, task]) => ({ key, task }));
                  
                  if (seriesTasks.length === 0) {
                    // Fallback: try direct lookup
                    const task = tasksMap[linkedTask.id];
                    if (!task) {
                      return (
                        <div key={linkedTask.id} className="rounded-lg p-3 bg-muted/20 border text-sm flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                          <span className="text-muted-foreground">{linkedTask.task_title || 'Loading task...'}</span>
                        </div>
                      );
                    }
                    return (
                      <EnhancedTaskItem
                        key={linkedTask.id}
                        task={task}
                        allTasks={Object.values(tasksMap)}
                        familyMembers={familyMembers}
                        onToggle={() => onCompleteTask?.(linkedTask, task)}
                        showActions={false}
                        currentMemberId={task.assignees?.[0]?.profile_id}
                        memberColor={task.assignees?.[0]?.profile?.color}
                      />
                    );
                  }
                  
                  // Render each member's task
                  return seriesTasks.map(({ key, task }) => {
                    const memberId = (task as any)._member_id || task.assignees?.[0]?.profile_id;
                    const memberProfile = task.assignees?.[0]?.profile;
                    return (
                      <EnhancedTaskItem
                        key={key}
                        task={task}
                        allTasks={Object.values(tasksMap)}
                        familyMembers={familyMembers}
                        onToggle={() => onCompleteTask?.(linkedTask, task)}
                        showActions={false}
                        currentMemberId={memberId}
                        memberColor={memberProfile?.color}
                      />
                    );
                  });
                })}
              </>
            ) : (
              /* Regular task display for non-consistency goals */
              unassignedTasks.slice(0, 2).map((linkedTask) => {
                const task = tasksMap[linkedTask.id];
                if (!task) {
                  return (
                    <div key={linkedTask.id} className="rounded-lg p-3 bg-muted/20 border text-sm flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                      <span className="text-muted-foreground">{linkedTask.task_title || 'Loading task...'}</span>
                    </div>
                  );
                }
                return (
                  <EnhancedTaskItem
                    key={linkedTask.id}
                    task={task}
                    allTasks={Object.values(tasksMap)}
                    familyMembers={familyMembers}
                    onToggle={() => onCompleteTask?.(linkedTask, task)}
                    showActions={false}
                  />
                );
              })
            )}
            {unassignedTasks.length > (goal.goal_type === 'consistency' ? 5 : 2) && (
              <span className="text-xs text-muted-foreground">
                +{unassignedTasks.length - (goal.goal_type === 'consistency' ? 5 : 2)} more tasks
              </span>
            )}
          </div>
        )}

        {/* Completed goal: show final result summary */}
        {goal.status === 'completed' && (
          <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Final result: {Math.round(percent)}%
                {progress && 'total_completions' in progress && ` (${progress.total_completions} completions)`}
                {progress && 'current_count' in progress && ` (${(progress as any).current_count}/${(progress as any).target_count})`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
