import { useState } from 'react';
import { 
  Target, Users, Calendar, Trophy, Pause, Play, 
  Archive, Trash2, Edit, Flame
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GoalProgressRing } from './GoalProgressRing';
import { GraceIndicator } from './GraceIndicator';
import { MilestoneList } from './MilestoneList';
import { ParticipantContributions } from './ParticipantContributions';
import { LinkedTasksList } from './LinkedTasksList';
import { MemberConsistencyGrid } from './MemberConsistencyGrid';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useGoals } from '@/hooks/useGoals';
import { useConsistencyCompletions } from '@/hooks/useConsistencyCompletions';
import { useTaskCompletion } from '@/hooks/useTaskCompletion';
import { useGoalLinkedTasks } from '@/hooks/useGoalLinkedTasks';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Goal, GoalLinkedTask } from '@/types/goal';
import { format, differenceInDays } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GoalDetailDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (goal: Goal) => void;
}

export function GoalDetailDialog({ goal, open, onOpenChange, onEdit }: GoalDetailDialogProps) {
  const { 
    profileId,
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    completeMilestone,
    uncompleteMilestone,
    unlinkTaskFromGoal,
    fetchGoals
  } = useGoals();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLinkedTasks, setDeleteLinkedTasks] = useState(false);
  
  // Fetch consistency completions for this goal (hook handles null goal)
  const { completionsByMember } = useConsistencyCompletions(goal);
  
  // Fetch family members
  const { data: familyMembers = [] } = useQuery({
    queryKey: ['family-members-for-goals'],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', profileId!)
        .single();
      
      if (!profile) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('sort_order');
      
      return data || [];
    },
    enabled: !!profileId
  });
  
  // Get current user profile
  const currentUserProfile = familyMembers.find(m => m.id === profileId) || null;
  
  // Task completion hook
  const { completeTask, uncompleteTask } = useTaskCompletion({
    currentUserProfile: currentUserProfile as any,
    isDashboardMode: false
  });
  
  // Get task map for linked tasks
  const { tasksMap } = useGoalLinkedTasks(goal?.linked_tasks || []);

  // Early return after all hooks
  if (!goal) return null;

  const progress = goal.progress;
  const percent = progress?.current_percent ?? 0;
  const isOwner = goal.created_by === profileId;
  const isParent = true;
  const canEdit = isOwner || isParent;
  const isConsistencyGoal = goal.goal_type === 'consistency';
  
  // Handle task completion/uncomplete
  const handleTaskComplete = async (linkedTask: GoalLinkedTask) => {
    const task = tasksMap[linkedTask.id];
    if (!task) return;
    
    const hasCompletion = task.task_completions && task.task_completions.length > 0;
    
    if (hasCompletion) {
      await uncompleteTask(task, () => fetchGoals());
    } else {
      await completeTask(task, () => fetchGoals());
    }
  };

  const handlePause = async () => {
    await pauseGoal(goal.id);
  };

  const handleResume = async () => {
    await resumeGoal(goal.id);
  };

  const handleArchive = async () => {
    await archiveGoal(goal.id);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteGoal(goal.id, deleteLinkedTasks);
    setShowDeleteConfirm(false);
    setDeleteLinkedTasks(false);
    onOpenChange(false);
  };

  const handleEdit = () => {
    onEdit?.(goal);
    onOpenChange(false);
  };

  const getGoalTypeDescription = () => {
    if (goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria) {
      const criteria = goal.success_criteria;
      if (criteria.frequency === 'weekly') {
        return `${criteria.times_per_week}x per week for ${criteria.time_window_days} days (${criteria.threshold_percent}% target)`;
      }
      return `Daily for ${criteria.time_window_days} days (${criteria.threshold_percent}% target)`;
    }
    if (goal.goal_type === 'target_count' && 'target_count' in goal.success_criteria) {
      return `Reach ${goal.success_criteria.target_count} completions`;
    }
    if (goal.goal_type === 'project') {
      return 'Complete all milestones';
    }
    return '';
  };

  const getDaysRemaining = () => {
    if (!goal.end_date) return null;
    const days = differenceInDays(new Date(goal.end_date), new Date());
    return days;
  };

  const daysRemaining = getDaysRemaining();

  // Get all assignees for display
  const allAssignees = goal.assignees && goal.assignees.length > 0 
    ? goal.assignees 
    : goal.assignee 
      ? [{ profile_id: goal.assignee.id, profile: goal.assignee }] 
      : [];

  // Check if goal has linked tasks
  const hasLinkedTasks = goal.linked_tasks && goal.linked_tasks.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  {isConsistencyGoal ? (
                    <Flame className="h-5 w-5 text-orange-500" />
                  ) : goal.goal_scope === 'family' ? (
                    <Users className="h-5 w-5 text-primary" />
                  ) : (
                    <Target className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-xl">{goal.title}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{goal.goal_type}</Badge>
                    {goal.status === 'paused' && <Badge variant="secondary">Paused</Badge>}
                    {goal.status === 'completed' && <Badge className="bg-green-500">Completed</Badge>}
                    {goal.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>
          
          {/* Assignees at top */}
          {allAssignees.length > 0 && (
            <div className="flex items-center gap-3 py-3 border-b">
              <span className="text-sm text-muted-foreground">Assigned to:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {allAssignees.map((a) => (
                  <div key={a.profile_id} className="flex items-center gap-2">
                    <UserAvatar 
                      name={a.profile?.display_name || ''} 
                      color={a.profile?.color || '#888'}
                      avatarIcon={a.profile?.avatar_url || undefined}
                      size="sm"
                    />
                    <span className="text-sm font-medium">{a.profile?.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Progress Section - Different layout for consistency vs other goals */}
          {isConsistencyGoal && 'time_window_days' in goal.success_criteria ? (
            <div className="space-y-4 py-4">
              {/* Consistency Goal Header */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(goal.start_date), 'MMM d, yyyy')}</span>
                  {goal.end_date && (
                    <span>→ {format(new Date(goal.end_date), 'MMM d, yyyy')}</span>
                  )}
                </div>
                
                {daysRemaining !== null && (
                  <Badge variant={daysRemaining <= 7 ? 'destructive' : 'secondary'}>
                    {daysRemaining <= 0 ? 'Ended' : `${daysRemaining} days left`}
                  </Badge>
                )}
                
                {goal.reward && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <Trophy className="h-4 w-4" />
                    <span className="font-medium">{goal.reward.title}</span>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">{getGoalTypeDescription()}</p>
              
              {goal.description && (
                <p className="text-muted-foreground">{goal.description}</p>
              )}
              
              {/* Grace Indicator */}
              {progress?.goal_type === 'consistency' && 'grace_remaining' in progress && (
                <GraceIndicator
                  graceRemaining={progress.grace_remaining}
                  graceUsed={progress.grace_used}
                  totalDays={progress.total_days}
                  thresholdPercent={progress.threshold_percent}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-6 py-4">
              <GoalProgressRing percent={percent} size="lg" />
              
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">{getGoalTypeDescription()}</p>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(goal.start_date), 'MMM d, yyyy')}</span>
                    {goal.end_date && (
                      <span>→ {format(new Date(goal.end_date), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                  
                  {daysRemaining !== null && (
                    <Badge variant={daysRemaining <= 7 ? 'destructive' : 'secondary'}>
                      {daysRemaining <= 0 ? 'Ended' : `${daysRemaining} days left`}
                    </Badge>
                  )}
                </div>
                
                {goal.reward && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <Trophy className="h-4 w-4" />
                    <span className="font-medium">{goal.reward.title}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {!isConsistencyGoal && goal.description && (
            <p className="text-muted-foreground">{goal.description}</p>
          )}
          
          <Separator />
          
          {/* Progress Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Progress Details</h3>
            
            {/* Consistency Goal: Show per-member grids */}
            {isConsistencyGoal && 'time_window_days' in goal.success_criteria && (
              <div className="space-y-4">
                {allAssignees.length > 0 ? (
                  <div className="space-y-3">
                    {allAssignees.map((assignee) => (
                      <MemberConsistencyGrid
                        key={assignee.profile_id}
                        member={{
                          id: assignee.profile_id,
                          display_name: assignee.profile?.display_name || 'Unknown',
                          color: assignee.profile?.color || '#888',
                          avatar_url: assignee.profile?.avatar_url
                        }}
                        startDate={goal.start_date}
                        totalDays={(goal.success_criteria as { time_window_days: number }).time_window_days}
                        completedDates={completionsByMember[assignee.profile_id] || []}
                      />
                    ))}
                  </div>
                ) : (
                  // Fallback if no assignees
                  <div className="p-4 rounded-lg bg-muted/30 text-center text-muted-foreground">
                    No participants assigned
                  </div>
                )}
                
                {progress?.goal_type === 'consistency' && 'total_completions' in progress && (
                  <div className="p-4 rounded-lg border">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall progress to threshold</span>
                      <span className="font-medium">{percent}% / {progress.threshold_percent}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (percent / progress.threshold_percent) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {progress?.goal_type === 'target_count' && 'current_count' in progress && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-4xl font-bold">
                    {progress.current_count} / {progress.target_count}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Completions</div>
                </div>
                
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}
            
            {progress?.goal_type === 'project' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-4xl font-bold">
                    {(progress as any).completed_tasks ?? 0} / {(progress as any).total_tasks ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Tasks Complete</div>
                </div>
                {'completed_milestones' in progress && progress.total_milestones > 0 && (
                  <div className="text-sm text-muted-foreground text-center">
                    {progress.completed_milestones} / {progress.total_milestones} Milestones
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* Goal Tasks Section - only for non-project goals */}
          {goal.goal_type !== 'project' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Goal Tasks
              </h3>
              <LinkedTasksList 
                linkedTasks={goal.linked_tasks || []}
                onComplete={handleTaskComplete}
                canEdit={false}
                showEmpty={true}
              />
            </div>
          )}
          
          {/* Milestones Section for project goals */}
          {goal.goal_type === 'project' && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Milestones</h3>
                <MilestoneList 
                  milestones={goal.milestones || []}
                  linkedTasks={goal.linked_tasks || []}
                  onComplete={canEdit ? completeMilestone : undefined}
                  onUncomplete={canEdit ? uncompleteMilestone : undefined}
                  onCompleteTask={handleTaskComplete}
                  canComplete={canEdit}
                  canEdit={false}
                />
              </div>
            </>
          )}
          
          {/* Team Contributions for family goals */}
          {goal.goal_scope === 'family' && progress?.participant_progress && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Team Contributions</h3>
                <ParticipantContributions participants={progress.participant_progress} />
              </div>
            </>
          )}
          
          {/* Action Buttons - moved to bottom */}
          {canEdit && goal.status !== 'archived' && goal.status !== 'completed' && (
            <>
              <Separator />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {goal.status === 'active' ? (
                  <Button variant="outline" size="sm" onClick={handlePause}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleResume}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) setDeleteLinkedTasks(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{goal.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {hasLinkedTasks && (
            <div className="flex items-center space-x-2 py-4 px-1">
              <Checkbox 
                id="delete-tasks" 
                checked={deleteLinkedTasks}
                onCheckedChange={(checked) => setDeleteLinkedTasks(checked === true)}
              />
              <Label 
                htmlFor="delete-tasks" 
                className="text-sm font-normal cursor-pointer"
              >
                Also delete {goal.linked_tasks?.length} linked task{(goal.linked_tasks?.length || 0) > 1 ? 's' : ''}
              </Label>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}