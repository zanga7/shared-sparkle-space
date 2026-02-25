import { useState, useEffect } from 'react';
import { Target, Users, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import type { Reward } from '@/types/rewards';

interface TargetGoalSetupProps {
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
  onSubmit: (data: TargetGoalData) => Promise<void>;
  onBack: () => void;
  loading?: boolean;
}

export interface TargetGoalData {
  title: string;
  description?: string;
  taskTitle: string;
  taskPoints: number;
  taskGroup: string;
  targetCount: number;
  assignees: string[];
  rewardId?: string;
}

const TARGET_PRESETS = [
  { value: 10, label: '10', description: 'Quick challenge' },
  { value: 25, label: '25', description: 'Short goal' },
  { value: 50, label: '50', description: 'Medium goal' },
  { value: 100, label: '100', description: 'Big challenge' },
];

const TASK_GROUPS = [
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'general', label: 'General' },
];

export function TargetGoalSetup({
  familyMembers,
  rewards,
  onSubmit,
  onBack,
  loading = false,
}: TargetGoalSetupProps) {
  const [step, setStep] = useState(1);

  // Task info
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPoints, setTaskPoints] = useState(5);
  const [taskGroup, setTaskGroup] = useState('general');

  // Target
  const [targetCount, setTargetCount] = useState(25);
  const [customTarget, setCustomTarget] = useState(false);

  // Members
  const [assignees, setAssignees] = useState<string[]>([]);

  // Final details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardId, setRewardId] = useState('');

  // Auto-generate goal title
  useEffect(() => {
    if (taskTitle && !title) {
      setTitle(`${targetCount}x ${taskTitle}`);
    }
  }, [taskTitle, targetCount]);

  const handleSubmit = async () => {
    if (!taskTitle.trim() || assignees.length === 0) return;

    await onSubmit({
      title: title || `${targetCount}x ${taskTitle}`,
      description: description || undefined,
      taskTitle,
      taskPoints,
      taskGroup,
      targetCount,
      assignees,
      rewardId: rewardId && rewardId !== 'none' ? rewardId : undefined,
    });
  };

  const canProceedStep1 = taskTitle.trim().length > 0;
  const canProceedStep2 = assignees.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Create Target Goal</h2>
          <p className="text-sm text-muted-foreground">
            Complete a task a set number of times
          </p>
        </div>
      </div>

      {/* Step 1: Task + Target */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 1 of 3</Badge>
            <span>Define the task and target</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>What task will be repeated?</Label>
              <Input
                placeholder="e.g., Go for a walk, Complete a book chapter"
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
                    {TASK_GROUPS.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label>How many times?</Label>
              <div className="grid grid-cols-2 gap-2">
                {TARGET_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setTargetCount(preset.value);
                      setCustomTarget(false);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all
                      ${
                        !customTarget && targetCount === preset.value
                          ? 'border-primary bg-primary/10'
                          : 'hover:border-primary/50'
                      }`}
                  >
                    <div className="font-medium text-sm">{preset.label} times</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCustomTarget(true)}
                className={`w-full p-3 rounded-lg border text-left transition-all
                  ${customTarget ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
              >
                <div className="font-medium text-sm">Custom target</div>
                {customTarget && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min={2}
                      max={1000}
                      value={targetCount}
                      onChange={(e) =>
                        setTargetCount(parseInt(e.target.value) || 25)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">times</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Members */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 2 of 3</Badge>
            <span>Who&apos;s participating?</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants
              </Label>
              <MultiSelectAssignees
                familyMembers={familyMembers
                  .filter((m) => m.status !== 'inactive')
                  .map((m) => ({
                    id: m.id,
                    display_name: m.display_name,
                    role: m.role,
                    color: m.color,
                    avatar_url: m.avatar_url || undefined,
                    total_points: m.total_points || 0,
                    family_id: m.family_id || '',
                  }))}
                selectedAssignees={assignees}
                onAssigneesChange={setAssignees}
                placeholder="Select who will track this goal..."
              />
              <p className="text-xs text-muted-foreground">
                Each member will have their own progress counter
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Final Details */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Step 3 of 3</Badge>
            <span>Final details</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input
                placeholder={`${targetCount}x ${taskTitle}`}
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
                  {rewards
                    .filter((r) => r.is_active)
                    .map((reward) => (
                      <SelectItem key={reward.id} value={reward.id}>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span>{reward.title}</span>
                          <span className="text-muted-foreground">
                            ({reward.cost_points} pts)
                          </span>
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
              <div>
                {taskTitle} ({taskPoints} pts)
              </div>
              <div className="text-muted-foreground">Target:</div>
              <div>{targetCount} completions</div>
              <div className="text-muted-foreground">Participants:</div>
              <div>
                {assignees.length} member{assignees.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canProceedStep1 || !canProceedStep2 || loading}
            >
              {loading ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
