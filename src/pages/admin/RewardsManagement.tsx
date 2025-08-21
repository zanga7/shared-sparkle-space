import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { useRewards } from '@/hooks/useRewards';
import { ApprovalQueue } from '@/components/rewards/ApprovalQueue';
import { EditRewardDialog } from '@/components/rewards/EditRewardDialog';
import { Plus, Gift, Settings, Coins, Edit, Trash2 } from 'lucide-react';
import type { Reward } from '@/types/rewards';

interface RewardFormData {
  title: string;
  description: string;
  cost_points: number;
  reward_type: 'once_off' | 'always_available';
  image_url: string | null;
}

export default function RewardsManagement() {
  const { rewards, loading, createReward } = useRewards();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<RewardFormData>({
    title: '',
    description: '',
    cost_points: 10,
    reward_type: 'always_available',
    image_url: null
  });

  const handleInputChange = (field: keyof RewardFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateReward = async () => {
    if (!formData.title || formData.cost_points <= 0) return;
    
    setIsCreating(true);
    try {
      await createReward({
        title: formData.title,
        description: formData.description || undefined,
        cost_points: formData.cost_points,
        reward_type: formData.reward_type,
        image_url: formData.image_url || undefined,
        is_active: true,
        assigned_to: null // Available to all by default
      });
      
      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        cost_points: 10,
        reward_type: 'always_available',
        image_url: null
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      cost_points: 10,
      reward_type: 'always_available',
      image_url: null
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2">Loading rewards...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rewards Management</h1>
          <p className="text-muted-foreground">
            Create and manage family rewards, and approve reward requests.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Create Reward
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Reward</DialogTitle>
              <DialogDescription>
                Add a new reward that family members can request with their points.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Extra Screen Time, Special Treat..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this reward includes..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="cost_points">Points Cost *</Label>
                <Input
                  id="cost_points"
                  type="number"
                  min="1"
                  value={formData.cost_points}
                  onChange={(e) => handleInputChange('cost_points', parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="reward_type">Reward Type</Label>
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

              <div>
                <ImageUpload
                  value={formData.image_url || undefined}
                  onChange={(url) => handleInputChange('image_url', url)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateReward} 
                disabled={!formData.title || formData.cost_points <= 0 || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Reward'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Approval Queue */}
      <div>
        <ApprovalQueue />
      </div>

      {/* Existing Rewards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Manage Rewards
        </h2>
        
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Gift className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rewards Created</h3>
              <p className="text-muted-foreground text-center">
                Create your first reward to motivate your family members!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward: Reward) => (
              <Card key={reward.id}>
                {reward.image_url && (
                  <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                    <img 
                      src={reward.image_url} 
                      alt={reward.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{reward.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
                        <Coins className="w-3 h-3" />
                        {reward.cost_points}
                      </Badge>
                    </div>
                  </div>
                  {reward.description && (
                    <CardDescription className="text-sm">
                      {reward.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={reward.reward_type === 'once_off' ? 'outline' : 'secondary'}>
                        {reward.reward_type === 'once_off' ? 'One-time' : 'Always available'}
                      </Badge>
                      <Badge variant={reward.is_active ? 'default' : 'outline'}>
                        {reward.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingReward(reward)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Reward Dialog */}
      <EditRewardDialog
        reward={editingReward}
        open={!!editingReward}
        onOpenChange={(open) => !open && setEditingReward(null)}
      />
    </div>
  );
}
