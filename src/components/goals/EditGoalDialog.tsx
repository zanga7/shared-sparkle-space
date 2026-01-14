import { useState, useEffect } from 'react';
import { Target, Trophy, Plus, X } from 'lucide-react';
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
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { useGoals } from '@/hooks/useGoals';
import type { Goal, UpdateGoalData } from '@/types/goal';
import type { Reward } from '@/types/rewards';
import { toast } from 'sonner';

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
  const { updateGoal, profileId } = useGoals();
  
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [rewardId, setRewardId] = useState<string>('');
  const [endDate, setEndDate] = useState('');
  
  // Consistency criteria (only editable for consistency goals)
  const [thresholdPercent, setThresholdPercent] = useState(80);

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
      
      // For consistency goals
      if (goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria) {
        setThresholdPercent(goal.success_criteria.threshold_percent);
      }
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
    
    // For consistency goals, update threshold if changed
    if (goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria) {
      if (thresholdPercent !== goal.success_criteria.threshold_percent) {
        data.success_criteria = {
          ...goal.success_criteria,
          threshold_percent: thresholdPercent
        };
      }
    }
    
    const success = await updateGoal(goal.id, data);
    setLoading(false);
    
    if (success) {
      toast.success('Goal updated');
      handleClose();
    }
  };

  if (!goal) return null;

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
          
          {goal.goal_type === 'consistency' && 'threshold_percent' in goal.success_criteria && (
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
                Percentage of days you need to complete the goal
              </p>
            </div>
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
