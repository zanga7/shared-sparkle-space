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
import { useGoals } from '@/hooks/useGoals';
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
  const { createGoal, profileId, familyId } = useGoals();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('consistency');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [rewardId, setRewardId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
  
  // Consistency criteria
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
    setStep(1);
    setTitle('');
    setDescription('');
    setGoalType('consistency');
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

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
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
        
        {step === 1 && (
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
              <Label>Goal Type</Label>
              <RadioGroup value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
                <div className="grid gap-2">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="consistency" className="mt-1" />
                    <div>
                      <div className="font-medium">Consistency</div>
                      <div className="text-sm text-muted-foreground">
                        Build habits with flexibility (e.g., 80% of 100 days)
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="target_count" className="mt-1" />
                    <div>
                      <div className="font-medium">Target Count</div>
                      <div className="text-sm text-muted-foreground">
                        Reach a total number (e.g., 30 walks)
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="project" className="mt-1" />
                    <div>
                      <div className="font-medium">Project</div>
                      <div className="text-sm text-muted-foreground">
                        Complete milestones (e.g., build a garden)
                      </div>
                    </div>
                  </label>
                </div>
              </RadioGroup>
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
            
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!title.trim()}>
                Next
              </Button>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="space-y-4">
            {goalType === 'consistency' && (
              <>
                <div className="space-y-2">
                  <Label>Time Window</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={timeWindowDays}
                      onChange={(e) => setTimeWindowDays(parseInt(e.target.value) || 100)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">days</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly')}>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="daily" />
                        <span>Daily</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="weekly" />
                        <span>Weekly</span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
                
                {frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Times per week</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        value={timesPerWeek}
                        onChange={(e) => setTimesPerWeek(parseInt(e.target.value) || 4)}
                        min={1}
                        max={7}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">times</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Success Threshold: {thresholdPercent}%</Label>
                  <Slider 
                    value={[thresholdPercent]}
                    onValueChange={(v) => setThresholdPercent(v[0])}
                    min={50}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can miss up to {Math.floor(timeWindowDays * (1 - thresholdPercent / 100))} days
                  </p>
                </div>
              </>
            )}
            
            {goalType === 'target_count' && (
              <div className="space-y-2">
                <Label>Target Count</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value) || 30)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">completions</span>
                </div>
              </div>
            )}
            
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
        
        {step === 3 && (
          <div className="space-y-4">
            <TaskLinkingSection
              familyId={familyId}
              selectedTaskIds={linkedTaskIds}
              selectedSeriesIds={linkedSeriesIds}
              selectedRotatingIds={linkedRotatingIds}
              onTasksChange={setLinkedTaskIds}
              onSeriesChange={setLinkedSeriesIds}
              onRotatingChange={setLinkedRotatingIds}
            />
            
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
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
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
