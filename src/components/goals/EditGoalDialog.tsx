import { useState, useEffect } from 'react';
import { Target, Trophy, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Flame, Calendar, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { TaskLinkingSection } from './TaskLinkingSection';
import { SimpleFrequencySelector } from './SimpleFrequencySelector';
import { useGoals } from '@/hooks/useGoals';
import type { Goal, UpdateGoalData, GoalMilestone } from '@/types/goal';
import type { Reward } from '@/types/rewards';
import type { RecurrenceRule } from '@/types/recurrence';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';

const DURATION_PRESETS = [
  { value: 21, label: '21 days', description: 'Form a habit' },
  { value: 30, label: '30 days', description: '1 month challenge' },
  { value: 60, label: '60 days', description: '2 month challenge' },
  { value: 100, label: '100 days', description: 'Ultimate challenge' },
];

interface EditGoalDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMembers: Array<{ id: string; display_name: string; color: string; role: 'parent' | 'child'; avatar_url?: string | null; status?: string }>;
  rewards: Reward[];
}

export function EditGoalDialog({ 
  goal,
  open, 
  onOpenChange, 
  familyMembers, 
  rewards 
}: EditGoalDialogProps) {
  const { 
    updateGoal, 
    profileId, 
    familyId, 
    linkTaskToGoal, 
    linkTaskToMilestone,
    unlinkTaskFromGoal, 
    fetchGoals,
    addMilestone,
    updateMilestone,
    deleteMilestone
  } = useGoals();
  
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [rewardId, setRewardId] = useState<string>('');
  const [endDate, setEndDate] = useState('');
  
  // Consistency criteria (editable for consistency goals)
  const [thresholdPercent, setThresholdPercent] = useState(80);
  const [durationDays, setDurationDays] = useState(30);
  const [customDuration, setCustomDuration] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>({
    frequency: 'daily',
    interval: 1,
    endType: 'never'
  });

  // Task linking (goal-level)
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [linkedSeriesIds, setLinkedSeriesIds] = useState<string[]>([]);
  const [linkedRotatingIds, setLinkedRotatingIds] = useState<string[]>([]);

  // Milestone editing (for project goals)
  const [editingMilestones, setEditingMilestones] = useState<GoalMilestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);

  // Per-milestone task linking
  const [milestoneTasks, setMilestoneTasks] = useState<Record<string, {
    taskIds: string[];
    seriesIds: string[];
    rotatingIds: string[];
  }>>({});

  // Reset form when goal changes
  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description || '');
      setRewardId(goal.reward_id || 'none');
      setEndDate(goal.end_date || '');
      
      // Set assignees from both assigned_to and assignees array
      const existingAssignees: string[] = [];
      if (goal.assigned_to) existingAssignees.push(goal.assigned_to);
      if (goal.assignees) {
        goal.assignees.forEach(a => {
          if (!existingAssignees.includes(a.profile_id)) {
            existingAssignees.push(a.profile_id);
          }
        });
      }
      setAssignees(existingAssignees);
      
      // For consistency goals - load all settings
      if (goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria) {
        const criteria = goal.success_criteria as { threshold_percent: number; time_window_days: number; frequency: 'daily' | 'weekly'; times_per_week?: number };
        setThresholdPercent(criteria.threshold_percent);
        setDurationDays(criteria.time_window_days || 30);
        
        // Parse frequency from success_criteria
        if (criteria.frequency === 'weekly') {
          setRecurrenceRule({
            frequency: 'weekly',
            interval: 1,
            weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            endType: 'never'
          });
        } else {
          setRecurrenceRule({
            frequency: 'daily',
            interval: 1,
            endType: 'never'
          });
        }
        setCustomDuration(!DURATION_PRESETS.some(p => p.value === criteria.time_window_days));
      }

      // Load milestones for project goals
      if (goal.goal_type === 'project' && goal.milestones) {
        setEditingMilestones([...goal.milestones]);
      } else {
        setEditingMilestones([]);
      }

      // Reset task links
      setLinkedTaskIds([]);
      setLinkedSeriesIds([]);
      setLinkedRotatingIds([]);
      setMilestoneTasks({});
      setNewMilestoneTitle('');
      setExpandedMilestoneId(null);
    }
  }, [goal]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!goal || !title.trim()) return;
    
    setLoading(true);
    
    const data: UpdateGoalData = {
      title,
      description: description || undefined,
      reward_id: rewardId && rewardId !== 'none' ? rewardId : undefined,
      end_date: endDate || undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
    };
    
    // For consistency goals, update all criteria
    if (goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria) {
      const timesPerWeek = recurrenceRule.frequency === 'weekly' 
        ? (recurrenceRule.weekdays?.length || 5) 
        : undefined;
      
      data.success_criteria = {
        time_window_days: durationDays,
        frequency: recurrenceRule.frequency === 'weekly' ? 'weekly' : 'daily',
        times_per_week: timesPerWeek,
        threshold_percent: thresholdPercent
      };
      
      // Recalculate end date based on duration
      const startDate = parseISO(goal.start_date);
      data.end_date = format(addDays(startDate, durationDays - 1), 'yyyy-MM-dd');
    }
    
    const success = await updateGoal(goal.id, data);
    
    // Link new goal-level tasks (non-project goals)
    if (success) {
      for (const taskId of linkedTaskIds) {
        await linkTaskToGoal(goal.id, { task_id: taskId });
      }
      for (const seriesId of linkedSeriesIds) {
        await linkTaskToGoal(goal.id, { task_series_id: seriesId });
      }
      for (const rotatingId of linkedRotatingIds) {
        await linkTaskToGoal(goal.id, { rotating_task_id: rotatingId });
      }
      
      // Link milestone tasks (for project goals)
      for (const [milestoneId, tasks] of Object.entries(milestoneTasks)) {
        for (const taskId of tasks.taskIds) {
          await linkTaskToMilestone(goal.id, milestoneId, { task_id: taskId });
        }
        for (const seriesId of tasks.seriesIds) {
          await linkTaskToMilestone(goal.id, milestoneId, { task_series_id: seriesId });
        }
        for (const rotatingId of tasks.rotatingIds) {
          await linkTaskToMilestone(goal.id, milestoneId, { rotating_task_id: rotatingId });
        }
      }
    }
    
    // Refresh goals to get updated data
    await fetchGoals();
    
    setLoading(false);
    
    if (success) {
      toast.success('Goal updated');
      handleClose();
    }
  };

  const handleUnlinkTask = async (linkId: string) => {
    await unlinkTaskFromGoal(linkId);
  };

  // Milestone handlers
  const handleAddMilestone = async () => {
    if (!goal || !newMilestoneTitle.trim()) return;
    
    const order = editingMilestones.length;
    const milestoneId = await addMilestone(goal.id, newMilestoneTitle.trim(), order);
    
    if (milestoneId) {
      setNewMilestoneTitle('');
      toast.success('Milestone added');
    }
  };

  const handleUpdateMilestoneTitle = async (milestoneId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    const success = await updateMilestone(milestoneId, { title: newTitle.trim() });
    if (success) {
      toast.success('Milestone updated');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const success = await deleteMilestone(milestoneId);
    if (success) {
      toast.success('Milestone deleted');
    }
  };

  if (!goal) return null;

  const isProjectGoal = goal.goal_type === 'project';
  const isConsistencyGoal = goal.goal_type === 'consistency';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Edit Goal
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Goal Title</Label>
            <Input 
              placeholder="e.g., 100 Days of Reading" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea 
              placeholder="What do you want to achieve?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Assigned to</Label>
            <MultiSelectAssignees
              familyMembers={familyMembers.filter(m => m.status !== 'inactive').map(m => ({
                id: m.id,
                display_name: m.display_name,
                role: m.role,
                color: m.color,
                avatar_url: m.avatar_url || undefined,
                total_points: 0,
                family_id: ''
              }))}
              selectedAssignees={assignees}
              onAssigneesChange={setAssignees}
              placeholder="Select member(s)..."
            />
          </div>
          
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          
          {/* Consistency Goal Options - Full editing like setup */}
          {isConsistencyGoal && 'threshold_percent' in goal.success_criteria && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Consistency Settings
                </Label>
                
                {/* Frequency selector */}
                <SimpleFrequencySelector
                  rule={recurrenceRule}
                  onRuleChange={setRecurrenceRule}
                />
                
                {/* Duration */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Goal Duration
                  </Label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {DURATION_PRESETS.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setDurationDays(preset.value);
                          setCustomDuration(false);
                        }}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          !customDuration && durationDays === preset.value 
                            ? 'border-primary bg-primary/10' 
                            : 'hover:border-primary/50'
                        )}
                      >
                        <div className="font-medium text-sm">{preset.label}</div>
                        <div className="text-xs text-muted-foreground">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setCustomDuration(true)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      customDuration ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                    )}
                  >
                    <div className="font-medium text-sm">Custom duration</div>
                    {customDuration && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input 
                          type="number"
                          min={7}
                          max={365}
                          value={durationDays}
                          onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    )}
                  </button>
                </div>
                
                {/* Success threshold */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Success Threshold: {thresholdPercent}%</Label>
                    <span className="text-sm text-muted-foreground">
                      Can miss up to {Math.floor(durationDays * (1 - thresholdPercent / 100))} days
                    </span>
                  </div>
                  <Slider 
                    value={[thresholdPercent]}
                    onValueChange={(v) => setThresholdPercent(v[0])}
                    min={50}
                    max={100}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>50% (flexible)</span>
                    <span>100% (perfect)</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Milestone Editing for Project Goals */}
          {isProjectGoal && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-base font-semibold">Milestones</Label>
                <p className="text-xs text-muted-foreground">
                  Define the steps toward completing this project goal
                </p>

                {/* Existing milestones */}
                {editingMilestones.length > 0 && (
                  <div className="space-y-2">
                    {editingMilestones.map((milestone, index) => (
                      <Collapsible 
                        key={milestone.id}
                        open={expandedMilestoneId === milestone.id}
                        onOpenChange={(open) => setExpandedMilestoneId(open ? milestone.id : null)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 p-3 bg-muted/50">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <Badge variant="outline" className="text-xs">
                              {index + 1}
                            </Badge>
                            <Input
                              value={milestone.title}
                              onChange={(e) => {
                                const updated = [...editingMilestones];
                                updated[index] = { ...milestone, title: e.target.value };
                                setEditingMilestones(updated);
                              }}
                              onBlur={() => handleUpdateMilestoneTitle(milestone.id, milestone.title)}
                              className="flex-1 h-8"
                            />
                            {milestone.is_completed && (
                              <Badge className="bg-green-500 text-xs">Done</Badge>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                {expandedMilestoneId === milestone.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteMilestone(milestone.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <CollapsibleContent>
                            <div className="p-3 border-t bg-background">
                              <TaskLinkingSection
                                familyId={familyId}
                                linkedTasks={goal.linked_tasks?.filter(lt => lt.milestone_id === milestone.id)}
                                selectedTaskIds={milestoneTasks[milestone.id]?.taskIds || []}
                                selectedSeriesIds={milestoneTasks[milestone.id]?.seriesIds || []}
                                selectedRotatingIds={milestoneTasks[milestone.id]?.rotatingIds || []}
                                onTasksChange={(ids) => setMilestoneTasks(prev => ({
                                  ...prev,
                                  [milestone.id]: { ...prev[milestone.id], taskIds: ids, seriesIds: prev[milestone.id]?.seriesIds || [], rotatingIds: prev[milestone.id]?.rotatingIds || [] }
                                }))}
                                onSeriesChange={(ids) => setMilestoneTasks(prev => ({
                                  ...prev,
                                  [milestone.id]: { ...prev[milestone.id], seriesIds: ids, taskIds: prev[milestone.id]?.taskIds || [], rotatingIds: prev[milestone.id]?.rotatingIds || [] }
                                }))}
                                onRotatingChange={(ids) => setMilestoneTasks(prev => ({
                                  ...prev,
                                  [milestone.id]: { ...prev[milestone.id], rotatingIds: ids, taskIds: prev[milestone.id]?.taskIds || [], seriesIds: prev[milestone.id]?.seriesIds || [] }
                                }))}
                                onUnlink={handleUnlinkTask}
                                onNewTaskCreated={(taskId) => {
                                  // Auto-attach new task to this milestone
                                  setMilestoneTasks(prev => ({
                                    ...prev,
                                    [milestone.id]: { 
                                      ...prev[milestone.id], 
                                      taskIds: [...(prev[milestone.id]?.taskIds || []), taskId], 
                                      seriesIds: prev[milestone.id]?.seriesIds || [], 
                                      rotatingIds: prev[milestone.id]?.rotatingIds || [] 
                                    }
                                  }));
                                }}
                                milestoneId={milestone.id}
                                familyMembers={familyMembers.filter(m => m.status !== 'inactive').map(m => ({
                                  id: m.id,
                                  display_name: m.display_name,
                                  role: m.role,
                                  color: m.color,
                                  avatar_url: m.avatar_url || null,
                                  family_id: familyId || '',
                                  total_points: 0,
                                  created_at: '',
                                  updated_at: '',
                                  status: m.status || 'active',
                                  streak_count: 0
                                }))}
                                profileId={profileId || undefined}
                                basicTasksOnly={true}
                              />
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}

                {/* Add new milestone */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a new milestone..."
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMilestone();
                      }
                    }}
                  />
                  <Button 
                    variant="outline"
                    onClick={handleAddMilestone}
                    disabled={!newMilestoneTitle.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Goal-level task linking - only show for target_count goals */}
          {/* Project goals link tasks at the milestone level instead */}
          {/* Consistency goals have a fixed linked task created during setup */}
          {!isProjectGoal && !isConsistencyGoal && (
            <>
              <Separator />
              <TaskLinkingSection
                familyId={familyId}
                linkedTasks={goal.linked_tasks?.filter(lt => !lt.milestone_id)}
                selectedTaskIds={linkedTaskIds}
                selectedSeriesIds={linkedSeriesIds}
                selectedRotatingIds={linkedRotatingIds}
                onTasksChange={setLinkedTaskIds}
                onSeriesChange={setLinkedSeriesIds}
                onRotatingChange={setLinkedRotatingIds}
                onUnlink={handleUnlinkTask}
                onNewTaskCreated={(taskId) => {
                  // Auto-attach new task to goal
                  setLinkedTaskIds(prev => [...prev, taskId]);
                }}
                familyMembers={familyMembers.filter(m => m.status !== 'inactive').map(m => ({
                  id: m.id,
                  display_name: m.display_name,
                  role: m.role,
                  color: m.color,
                  avatar_url: m.avatar_url || null,
                  family_id: familyId || '',
                  total_points: 0,
                  created_at: '',
                  updated_at: '',
                  status: m.status || 'active',
                  streak_count: 0
                }))}
                profileId={profileId || undefined}
                basicTasksOnly={goal.goal_type === 'target_count'}
              />
            </>
          )}

          {/* Show linked task info for consistency goals (read-only) */}
          {isConsistencyGoal && goal.linked_tasks && goal.linked_tasks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Linked Recurring Task</Label>
                <p className="text-xs text-muted-foreground">
                  This consistency goal tracks completions of the task created during setup
                </p>
                <div className="p-3 rounded-lg border bg-muted/30">
                  {goal.linked_tasks.filter(lt => lt.task_series_id).map(lt => (
                    <div key={lt.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">Recurring</Badge>
                      <span className="text-muted-foreground">
                        Task series linked
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label>Reward (optional)</Label>
            <Select value={rewardId} onValueChange={setRewardId}>
              <SelectTrigger>
                <SelectValue placeholder="Select reward on completion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reward</SelectItem>
                {rewards.filter(r => r.is_active).map((reward) => (
                  <SelectItem key={reward.id} value={reward.id}>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      {reward.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
