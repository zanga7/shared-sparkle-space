import { useState } from 'react';
import { Target, Calendar, Trophy, Plus, X } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { TaskLinkingSection } from './TaskLinkingSection';
import { GoalTypeSelector } from './GoalTypeSelector';
import { ConsistencyGoalSetup, ConsistencyGoalData } from './ConsistencyGoalSetup';
import { TargetGoalSetup, TargetGoalData } from './TargetGoalSetup';
import { useGoals } from '@/hooks/useGoals';
import { useTaskSeries } from '@/hooks/useTaskSeries';
import { supabase } from '@/integrations/supabase/client';
import type { 
  GoalType, 
  CreateGoalData,
  ConsistencyCriteria,
  TargetCountCriteria,
  ProjectCriteria
} from '@/types/goal';
import type { Reward } from '@/types/rewards';
import { format, addMonths } from 'date-fns';

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMembers: Array<{ id: string; display_name: string; color: string; role: 'parent' | 'child'; avatar_url?: string | null; status?: string }>;
  rewards: Reward[];
}

export function CreateGoalDialog({ 
  open, 
  onOpenChange, 
  familyMembers, 
  rewards 
}: CreateGoalDialogProps) {
  const { createGoal, profileId, familyId, linkTaskToGoal } = useGoals();
  const { createTaskSeries } = useTaskSeries(familyId || undefined);
  
  // Step 0 = goal type selection
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [rewardId, setRewardId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
  
  // Consistency criteria (for non-wizard flow - legacy)
  const [timeWindowDays, setTimeWindowDays] = useState(100);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [timesPerWeek, setTimesPerWeek] = useState(4);
  const [thresholdPercent, setThresholdPercent] = useState(80);
  
  // Target count criteria
  const [targetCount, setTargetCount] = useState(30);
  
  // Project criteria - milestones
  const [milestones, setMilestones] = useState<Array<{ title: string; reward_id?: string }>>([]);
  const [newMilestone, setNewMilestone] = useState('');

  // Task linking
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [linkedSeriesIds, setLinkedSeriesIds] = useState<string[]>([]);
  const [linkedRotatingIds, setLinkedRotatingIds] = useState<string[]>([]);

  const resetForm = () => {
    setStep(0);
    setTitle('');
    setDescription('');
    setGoalType(null);
    setAssignees([]);
    setRewardId('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
    setTimeWindowDays(100);
    setFrequency('daily');
    setTimesPerWeek(4);
    setThresholdPercent(80);
    setTargetCount(30);
    setMilestones([]);
    setNewMilestone('');
    setLinkedTaskIds([]);
    setLinkedSeriesIds([]);
    setLinkedRotatingIds([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Handle goal type selection
  const handleGoalTypeSelect = (type: GoalType) => {
    setGoalType(type);
    if (type === 'consistency') {
      setStep(-1); // Consistency wizard
    } else if (type === 'target_count') {
      setStep(-2); // Target wizard
    } else {
      setStep(1);
    }
  };

  // Handle target goal creation (new wizard flow)
  const handleTargetGoalSubmit = async (data: TargetGoalData) => {
    if (!familyId || !profileId) return;
    
    setLoading(true);
    
    try {
      // If creating a new reward inline, do that first
      let finalRewardId = data.rewardId;
      if (data.newReward) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, family_id')
          .eq('id', profileId)
          .single();
        
        if (profile) {
          const { data: newReward, error: rewardError } = await supabase
            .from('rewards')
            .insert({
              title: data.newReward.title,
              description: data.newReward.description || null,
              cost_points: 0,
              reward_type: data.newReward.reward_type,
              is_active: true,
              auto_approve: true,
              assigned_to: data.newReward.assigned_to || null,
              family_id: profile.family_id,
              created_by: profile.id,
            })
            .select('id')
            .single();
          
          if (rewardError) {
            console.error('Error creating reward:', rewardError);
          } else if (newReward) {
            finalRewardId = newReward.id;
          }
        }
      }

      // Create a recurring task series with endType: after_count
      const seriesData = {
        family_id: familyId,
        created_by: profileId,
        title: data.taskTitle,
        description: undefined,
        points: data.taskPoints,
        task_group: data.taskGroup,
        completion_rule: 'everyone',
        recurrence_rule: {
          frequency: 'daily' as const,
          interval: 1,
          endType: 'after_count' as const,
          endCount: data.targetCount,
        },
        series_start: format(new Date(), 'yyyy-MM-dd'),
        series_end: undefined,
        assigned_profiles: data.assignees,
        is_active: true,
      };
      
      const series = await createTaskSeries(seriesData);
      
      if (!series) {
        throw new Error('Failed to create recurring task');
      }
      
      const goalData: CreateGoalData = {
        title: data.title,
        description: data.description,
        goal_type: 'target_count',
        goal_scope: data.assignees.length === 1 ? 'individual' : 'family',
        assigned_to: data.assignees.length === 1 ? data.assignees[0] : undefined,
        assignees: data.assignees,
        reward_id: finalRewardId,
        success_criteria: { target_count: data.targetCount },
        start_date: format(new Date(), 'yyyy-MM-dd'),
        linked_series_ids: [series.id],
      };
      
      const goal = await createGoal(goalData);
      
      if (goal) {
        handleClose();
      }
    } catch (error) {
      console.error('Error creating target goal:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle consistency goal creation (new wizard flow)
  const handleConsistencyGoalSubmit = async (data: ConsistencyGoalData) => {
    if (!familyId || !profileId) return;
    
    setLoading(true);
    
    try {
      // 1. Create the recurring task series
      const seriesData = {
        family_id: familyId,
        created_by: profileId,
        title: data.taskTitle,
        description: undefined,
        points: data.taskPoints,
        task_group: data.taskGroup,
        completion_rule: 'everyone', // Each member completes their own
        recurrence_rule: {
          ...data.recurrenceRule,
          endType: 'on_date' as const,
          endDate: data.endDate
        },
        series_start: data.startDate,
        series_end: data.endDate,
        assigned_profiles: data.assignees,
        is_active: true
      };
      
      const series = await createTaskSeries(seriesData);
      
      if (!series) {
        throw new Error('Failed to create recurring task');
      }
      
      // 2. Create the goal
      const successCriteria: ConsistencyCriteria = {
        time_window_days: data.durationDays,
        frequency: data.recurrenceRule.frequency === 'daily' ? 'daily' : 'weekly',
        interval: data.recurrenceRule.interval || 1,
        weekdays: data.recurrenceRule.weekdays || undefined,
        threshold_percent: data.thresholdPercent
      };
      
      const goalData: CreateGoalData = {
        title: data.title,
        description: data.description,
        goal_type: 'consistency',
        goal_scope: data.assignees.length === 1 ? 'individual' : 'family',
        assigned_to: data.assignees.length === 1 ? data.assignees[0] : undefined,
        assignees: data.assignees,
        reward_id: data.rewardId,
        success_criteria: successCriteria,
        start_date: data.startDate,
        end_date: data.endDate,
        linked_series_ids: [series.id]
      };
      
      const goal = await createGoal(goalData);
      
      if (goal) {
        handleClose();
      }
    } catch (error) {
      console.error('Error creating consistency goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !goalType) return;
    
    setLoading(true);
    
    let successCriteria: ConsistencyCriteria | TargetCountCriteria | ProjectCriteria;
    
    if (goalType === 'consistency') {
      successCriteria = {
        time_window_days: timeWindowDays,
        frequency,
        times_per_week: frequency === 'weekly' ? timesPerWeek : undefined,
        threshold_percent: thresholdPercent
      } as ConsistencyCriteria;
    } else if (goalType === 'target_count') {
      successCriteria = {
        target_count: targetCount
      } as TargetCountCriteria;
    } else {
      successCriteria = {
        requires_all_milestones: true
      } as ProjectCriteria;
    }
    
    // Determine scope based on assignees: family if multiple or none, individual if one
    const goalScope = assignees.length === 1 ? 'individual' : 'family';
    
    const data: CreateGoalData = {
      title,
      description: description || undefined,
      goal_type: goalType,
      goal_scope: goalScope,
      assigned_to: assignees.length === 1 ? assignees[0] : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
      reward_id: rewardId && rewardId !== 'none' ? rewardId : undefined,
      success_criteria: successCriteria,
      start_date: startDate,
      end_date: endDate,
      milestones: goalType === 'project' ? milestones.map((m, i) => ({
        title: m.title,
        milestone_order: i,
        completion_criteria: { type: 'manual' as const },
        reward_id: m.reward_id
      })) : undefined,
      linked_task_ids: linkedTaskIds.length > 0 ? linkedTaskIds : undefined,
      linked_series_ids: linkedSeriesIds.length > 0 ? linkedSeriesIds : undefined,
      linked_rotating_ids: linkedRotatingIds.length > 0 ? linkedRotatingIds : undefined
    };
    
    const result = await createGoal(data);
    setLoading(false);
    
    if (result) {
      handleClose();
    }
  };

  const addMilestone = () => {
    if (newMilestone.trim()) {
      setMilestones([...milestones, { title: newMilestone.trim() }]);
      setNewMilestone('');
    }
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Create Goal
          </DialogTitle>
        </DialogHeader>
        
        {/* Step 0: Goal Type Selection */}
        {step === 0 && (
          <GoalTypeSelector
            selectedType={goalType}
            onSelect={handleGoalTypeSelect}
          />
        )}
        
        {/* Consistency Goal Wizard (dedicated flow) */}
        {step === -1 && goalType === 'consistency' && (
          <ConsistencyGoalSetup
            familyMembers={familyMembers}
            rewards={rewards}
            onSubmit={handleConsistencyGoalSubmit}
            onBack={() => {
              setGoalType(null);
              setStep(0);
            }}
            loading={loading}
          />
        )}
        
        {/* Target Goal Wizard (dedicated flow) */}
        {step === -2 && goalType === 'target_count' && (
          <TargetGoalSetup
            familyMembers={familyMembers}
            rewards={rewards}
            onSubmit={handleTargetGoalSubmit}
            onBack={() => {
              setGoalType(null);
              setStep(0);
            }}
            loading={loading}
          />
        )}
        
        {/* Step 1: Basic Info (for project goals only) */}
        {step === 1 && goalType && goalType === 'project' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input 
                placeholder="e.g., Build a Treehouse" 
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
              <p className="text-xs text-muted-foreground">
                Leave empty for a family goal, or select specific members
              </p>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setGoalType(null); setStep(0); }}>
                Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={!title.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Goal-specific criteria */}
        {step === 2 && goalType && (
          <div className="space-y-4">
            
            
            {goalType === 'project' && (
              <div className="space-y-2">
                <Label>Milestones</Label>
                <div className="space-y-2">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-lg">
                      <span className="flex-1">{m.title}</span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeMilestone(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Add milestone..."
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                  />
                  <Button variant="outline" onClick={addMilestone}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Next
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Task linking */}
        {step === 3 && goalType && (
          <div className="space-y-4">
            <TaskLinkingSection
              familyId={familyId}
              selectedTaskIds={linkedTaskIds}
              selectedSeriesIds={linkedSeriesIds}
              selectedRotatingIds={linkedRotatingIds}
              onTasksChange={setLinkedTaskIds}
              onSeriesChange={setLinkedSeriesIds}
              onRotatingChange={setLinkedRotatingIds}
              onNewTaskCreated={(taskId) => {
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
              basicTasksOnly={goalType === 'project'}
            />
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Next
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 4: Reward selection */}
        {step === 4 && goalType && (
          <div className="space-y-4">
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
                        <span>{reward.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create Goal'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
