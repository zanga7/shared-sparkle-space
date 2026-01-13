import { useState } from 'react';
import { 
  Target, Users, Calendar, Trophy, Pause, Play, 
  Archive, Trash2, Edit, Link, X 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { GoalProgressRing } from './GoalProgressRing';
import { GraceIndicator } from './GraceIndicator';
import { MilestoneList } from './MilestoneList';
import { ParticipantContributions } from './ParticipantContributions';
import { LinkedTasksList } from './LinkedTasksList';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useGoals } from '@/hooks/useGoals';
import { useAuth } from '@/hooks/useAuth';
import type { Goal } from '@/types/goal';
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
}

export function GoalDetailDialog({ goal, open, onOpenChange }: GoalDetailDialogProps) {
  const { profile } = useAuth();
  const { 
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    completeMilestone,
    unlinkTaskFromGoal
  } = useGoals();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!goal) return null;

  const progress = goal.progress;
  const percent = progress?.current_percent ?? 0;
  const isOwner = goal.created_by === profile?.id;
  const isParent = profile?.role === 'parent';
  const canEdit = isOwner || isParent;

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
    await deleteGoal(goal.id);
    setShowDeleteConfirm(false);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  {goal.goal_scope === 'family' ? (
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
              
              {canEdit && goal.status !== 'archived' && goal.status !== 'completed' && (
                <div className="flex items-center gap-1">
                  {goal.status === 'active' ? (
                    <Button variant="ghost" size="icon" onClick={handlePause}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={handleResume}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={handleArchive}>
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {/* Progress Section */}
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
          
          {goal.description && (
            <p className="text-muted-foreground">{goal.description}</p>
          )}
          
          {/* Consistency Goal: Grace Indicator */}
          {progress?.goal_type === 'consistency' && 'grace_remaining' in progress && (
            <GraceIndicator
              graceRemaining={progress.grace_remaining}
              graceUsed={progress.grace_used}
              totalDays={progress.total_days}
              thresholdPercent={progress.threshold_percent}
            />
          )}
          
          <Separator />
          
          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="tasks">Linked Tasks</TabsTrigger>
              {goal.goal_type === 'project' && (
                <TabsTrigger value="milestones">Milestones</TabsTrigger>
              )}
              {goal.goal_scope === 'family' && (
                <TabsTrigger value="team">Team</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="progress" className="pt-4">
              {progress?.goal_type === 'consistency' && 'total_completions' in progress && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold">{progress.total_completions}</div>
                      <div className="text-sm text-muted-foreground">Completions</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold">{progress.days_elapsed}</div>
                      <div className="text-sm text-muted-foreground">Days Elapsed</div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress to threshold</span>
                      <span className="font-medium">{percent}% / {progress.threshold_percent}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (percent / progress.threshold_percent) * 100)}%` }}
                      />
                    </div>
                  </div>
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
              
              {progress?.goal_type === 'project' && 'completed_milestones' in progress && (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-4xl font-bold">
                    {progress.completed_milestones} / {progress.total_milestones}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Milestones Complete</div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="tasks" className="pt-4">
              <LinkedTasksList 
                linkedTasks={goal.linked_tasks || []}
                onUnlink={canEdit ? unlinkTaskFromGoal : undefined}
                canEdit={canEdit}
              />
            </TabsContent>
            
            {goal.goal_type === 'project' && (
              <TabsContent value="milestones" className="pt-4">
                <MilestoneList 
                  milestones={goal.milestones || []}
                  onComplete={canEdit ? completeMilestone : undefined}
                  canComplete={canEdit}
                />
              </TabsContent>
            )}
            
            {goal.goal_scope === 'family' && progress?.participant_progress && (
              <TabsContent value="team" className="pt-4">
                <ParticipantContributions participants={progress.participant_progress} />
              </TabsContent>
            )}
          </Tabs>
          
          {/* Assignee for individual goals */}
          {goal.goal_scope === 'individual' && goal.assignee && (
            <div className="flex items-center gap-3 pt-4 border-t">
              <UserAvatar 
                name={goal.assignee.display_name}
                color={goal.assignee.color}
                avatarIcon={goal.assignee.avatar_url || undefined}
                size="sm"
              />
              <div>
                <div className="text-sm font-medium">{goal.assignee.display_name}</div>
                <div className="text-xs text-muted-foreground">Assigned to</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{goal.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
