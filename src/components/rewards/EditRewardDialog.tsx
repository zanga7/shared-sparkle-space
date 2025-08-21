import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { useRewards } from '@/hooks/useRewards';
import type { Reward } from '@/types/rewards';

interface EditRewardDialogProps {
  reward: Reward | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditRewardFormData {
  title: string;
  description: string;
  cost_points: number;
  reward_type: 'once_off' | 'always_available';
  image_url: string | null;
  is_active: boolean;
}

export function EditRewardDialog({ reward, open, onOpenChange }: EditRewardDialogProps) {
  const { updateReward, deleteReward } = useRewards();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<EditRewardFormData>({
    title: '',
    description: '',
    cost_points: 10,
    reward_type: 'always_available',
    image_url: null,
    is_active: true
  });

  // Update form data when reward changes
  useEffect(() => {
    if (reward) {
      setFormData({
        title: reward.title,
        description: reward.description || '',
        cost_points: reward.cost_points,
        reward_type: reward.reward_type,
        image_url: reward.image_url || null,
        is_active: reward.is_active
      });
    }
  }, [reward]);

  const handleInputChange = (field: keyof EditRewardFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async () => {
    if (!reward || !formData.title || formData.cost_points <= 0) return;
    
    setIsUpdating(true);
    try {
      await updateReward(reward.id, {
        title: formData.title,
        description: formData.description || undefined,
        cost_points: formData.cost_points,
        reward_type: formData.reward_type,
        image_url: formData.image_url || undefined,
        is_active: formData.is_active
      });
      
      onOpenChange(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!reward) return;
    
    setIsDeleting(true);
    try {
      await deleteReward(reward.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    if (reward) {
      setFormData({
        title: reward.title,
        description: reward.description || '',
        cost_points: reward.cost_points,
        reward_type: reward.reward_type,
        image_url: reward.image_url || null,
        is_active: reward.is_active
      });
    }
  };

  if (!reward) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Reward</DialogTitle>
          <DialogDescription>
            Update the reward details. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              placeholder="e.g., Extra Screen Time, Special Treat..."
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Describe what this reward includes..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-cost_points">Points Cost *</Label>
            <Input
              id="edit-cost_points"
              type="number"
              min="1"
              value={formData.cost_points}
              onChange={(e) => handleInputChange('cost_points', parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reward_type">Reward Type</Label>
            <Select
              value={formData.reward_type}
              onValueChange={(value) => handleInputChange('reward_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always_available">Always Available</SelectItem>
                <SelectItem value="once_off">One-time Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ImageUpload
            value={formData.image_url || undefined}
            onChange={(url) => handleInputChange('image_url', url)}
            disabled={isUpdating}
          />

          <div className="flex items-center space-x-2">
            <Switch
              id="edit-is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="edit-is_active">Active (visible to family members)</Label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isUpdating || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Reward'}
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formData.title || formData.cost_points <= 0 || isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Update Reward'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}