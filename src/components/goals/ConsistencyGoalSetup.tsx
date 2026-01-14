import { useState, useEffect } from 'react';
import { Flame, Calendar, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';
import { Trophy } from 'lucide-react';
import type { Reward } from '@/types/rewards';
import type { TaskRecurrenceOptions, RecurrenceRule } from '@/types/recurrence';
import { format, addDays } from 'date-fns';

interface ConsistencyGoalSetupProps {
  familyMembers: Array<{ 
    id: string; 
    display_name: string; 
    color: string; 
    role: 'parent' | 'child';
    avatar_url?: string | null;
    status?: string;
    total_points?: number;
    family_id?: string;
  }>;
  rewards: Reward[];
  onSubmit: (data: ConsistencyGoalData) => Promise<void>;
  onBack: () => void;
  loading?: boolean;
}

export interface ConsistencyGoalData {
  // Goal info
  title: string;
  description?: string;
  
  // Task info (will create a new recurring task)
  taskTitle: string;
  taskPoints: number;
  taskGroup: string;
  
  // Recurrence settings
  recurrenceRule: RecurrenceRule;
  
  // Duration
  durationDays: number;
  startDate: string;
  endDate: string;
  
  // Success criteria
  thresholdPercent: number;
  
  // Members
  assignees: string[];
  
  // Reward
  rewardId?: string;
}

const DURATION_PRESETS = [
  { value: 21, label: '21 days', description: 'Form a habit' },
  { value: 30, label: '30 days', description: '1 month challenge' },
  { value: 60, label: '60 days', description: '2 month challenge' },
  { value: 100, label: '100 days', description: 'Ultimate challenge' },
];

const TASK_GROUPS = [
  'Morning Routine',
  'Evening Routine',
  'Health & Fitness',
  'Learning',
  'Chores',
  'Self Care',
  'Other'
];

export function ConsistencyGoalSetup({
  familyMembers,
  rewards,
  onSubmit,
  onBack,
  loading = false
}: ConsistencyGoalSetupProps) {
  const [step, setStep] = useState(1);
  
  // Goal info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Task info
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPoints, setTaskPoints] = useState(5);
  const [taskGroup, setTaskGroup] = useState('Morning Routine');
  
  // Recurrence
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(true);
  const [taskOptions, setTaskOptions] = useState<TaskRecurrenceOptions>({
    enabled: true,
    rule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never'
    },
    repeatFrom: 'scheduled',
    rotateBetweenMembers: false,
    skipWeekends: false,
    pauseDuringHolidays: false
  });
  
  // Duration
  const [durationDays, setDurationDays] = useState(30);
  const [customDuration, setCustomDuration] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Success threshold
  const [thresholdPercent, setThresholdPercent] = useState(80);
  
  // Members
  const [assignees, setAssignees] = useState<string[]>([]);
  
  // Reward
  const [rewardId, setRewardId] = useState<string>('');
  
  // Calculate end date from start and duration
  const endDate = format(addDays(new Date(startDate), durationDays - 1), 'yyyy-MM-dd');
  
  // Auto-generate goal title from task title
  useEffect(() => {
    if (taskTitle && !title) {
      setTitle(`${durationDays} Days of ${taskTitle}`);
    }
  }, [taskTitle, durationDays]);
  
  const handleSubmit = async () => {
    if (!taskTitle.trim() || assignees.length === 0) return;
    
    const data: ConsistencyGoalData = {
      title: title || `${durationDays} Days of ${taskTitle}`,
      description: description || undefined,
      taskTitle,
      taskPoints,
      taskGroup,
      recurrenceRule: taskOptions.rule,
      durationDays,
      startDate,
      endDate,
      thresholdPercent,
      assignees,
      rewardId: rewardId && rewardId !== 'none' ? rewardId : undefined
    };
    
    await onSubmit(data);
  };
  
  const canProceedStep1 = taskTitle.trim().length > 0;
  const canProceedStep2 = true; // Recurrence is always valid
  const canProceedStep3 = assignees.length > 0;
  const canSubmit = canProceedStep1 && canProceedStep2 && canProceedStep3;
  
  const missableDays = Math.floor(durationDays * (1 - thresholdPercent / 100));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-orange-500/10">
          <Flame className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h2 className="font-semibold">Create Consistency Goal</h2>
          <p className="text-sm text-muted-foreground">
            Build a streak habit with daily tracking
          </p>
        </div>
      </div>
      
      {/* Step 1: Task Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 1 of 4</Badge>
            <span>Define the recurring task</span>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>What task will be repeated?</Label>
              <Input 
                placeholder="e.g., Brush teeth, Read for 20 minutes, Practice piano"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Points per completion</Label>
                <Input 
                  type="number"
                  min={1}
                  max={100}
                  value={taskPoints}
                  onChange={(e) => setTaskPoints(parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="space-y-2">
                <Label>Task group</Label>
                <Select value={taskGroup} onValueChange={setTaskGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_GROUPS.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>Back</Button>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 2: Recurrence & Duration */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 2 of 4</Badge>
            <span>Set frequency and duration</span>
          </div>
          
          {/* Recurrence settings */}
          <UnifiedRecurrencePanel
            enabled={recurrenceEnabled}
            onEnabledChange={setRecurrenceEnabled}
            startDate={new Date(startDate)}
            type="task"
            taskOptions={taskOptions}
            onTaskOptionsChange={setTaskOptions}
          />
          
          <div className="space-y-3 pt-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Goal Duration
            </Label>
            
            <div className="grid grid-cols-2 gap-2">
              {DURATION_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setDurationDays(preset.value);
                    setCustomDuration(false);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all
                    ${!customDuration && durationDays === preset.value 
                      ? 'border-primary bg-primary/10' 
                      : 'hover:border-primary/50'}`}
                >
                  <div className="font-medium text-sm">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCustomDuration(true)}
              className={`w-full p-3 rounded-lg border text-left transition-all
                ${customDuration ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
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
          
          <div className="grid grid-cols-2 gap-3">
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
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 3: Members & Threshold */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 3 of 4</Badge>
            <span>Who&apos;s participating?</span>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants
              </Label>
              <MultiSelectAssignees
                familyMembers={familyMembers.filter(m => m.status !== 'inactive').map(m => ({
                  id: m.id,
                  display_name: m.display_name,
                  role: m.role,
                  color: m.color,
                  avatar_url: m.avatar_url || undefined,
                  total_points: m.total_points || 0,
                  family_id: m.family_id || ''
                }))}
                selectedAssignees={assignees}
                onAssigneesChange={setAssignees}
                placeholder="Select who will track this goal..."
              />
              <p className="text-xs text-muted-foreground">
                Each member will have their own streak grid
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>Success Threshold: {thresholdPercent}%</Label>
                <span className="text-sm text-muted-foreground">
                  Can miss up to {missableDays} days
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
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)} disabled={!canProceedStep3}>
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 4: Final Details */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 4 of 4</Badge>
            <span>Final details</span>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input 
                placeholder={`${durationDays} Days of ${taskTitle}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea 
                placeholder="Why is this goal important?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Reward on completion (optional)
              </Label>
              <Select value={rewardId} onValueChange={setRewardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reward..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reward</SelectItem>
                  {rewards.filter(r => r.is_active).map((reward) => (
                    <SelectItem key={reward.id} value={reward.id}>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span>{reward.title}</span>
                        <span className="text-muted-foreground">({reward.cost_points} pts)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Task:</div>
              <div>{taskTitle} ({taskPoints} pts)</div>
              <div className="text-muted-foreground">Duration:</div>
              <div>{durationDays} days</div>
              <div className="text-muted-foreground">Target:</div>
              <div>{thresholdPercent}% completion</div>
              <div className="text-muted-foreground">Participants:</div>
              <div>{assignees.length} member{assignees.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
              {loading ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
