import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { MultiAssigneeAvatarGroup } from '@/components/ui/multi-assignee-avatar-group';
import { useRewards } from '@/hooks/useRewards';

import { EditRewardDialog } from '@/components/rewards/EditRewardDialog';
import { Plus, Gift, Settings, Coins, Edit, Trash2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Reward } from '@/types/rewards';

interface RewardFormData {
  title: string;
  description: string;
  cost_points: number;
  reward_type: 'once_off' | 'always_available' | 'group_contribution';
  image_url: string | null;
  assigned_to: string[] | null;
  auto_approve: boolean;
}

export default function RewardsManagement() {
  const { rewards, loading, createReward, updateReward, deleteReward, refreshData } = useRewards();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [deletingReward, setDeletingReward] = useState<Reward | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [formData, setFormData] = useState<RewardFormData>({
    title: '',
    description: '',
    cost_points: 10,
    reward_type: 'always_available',
    image_url: null,
    assigned_to: null,
    auto_approve: false
  });

  const handleInputChange = (field: keyof RewardFormData, value: string | number | string[] | null | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Fetch family members
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, role, color, status')
          .order('display_name');
        
        if (error) {
          console.error('Error fetching family members:', error);
          return;
        }
        
        setFamilyMembers(data || []);
      } catch (error) {
        console.error('Error fetching family members:', error);
      }
    };

    fetchFamilyMembers();
  }, []);
  
  // Fetch reward data function similar to MemberManagement
  const fetchRewardData = async () => {
    await refreshData();
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
        assigned_to: formData.assigned_to,
        is_active: true,
        auto_approve: formData.auto_approve
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
      fetchRewardData(); // Refresh immediately like MemberManagement
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateReward = async (rewardId: string, rewardData: any) => {
    try {
      await updateReward(rewardId, rewardData);
      setEditingReward(null);
      fetchRewardData(); // Refresh immediately
    } catch (error) {
      console.error('Error updating reward:', error);
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    try {
      console.log('Attempting to delete reward:', reward.id);
      await deleteReward(reward.id);
      console.log('Delete completed, refreshing data...');
      setDeletingReward(null);
      await fetchRewardData(); // Refresh immediately
    } catch (error) {
      console.error('Error deleting reward:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      cost_points: 10,
      reward_type: 'always_available',
      image_url: null,
      assigned_to: null,
      auto_approve: false
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
            Create and manage family rewards that members can request with their points.
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
                    <SelectItem value="group_contribution">Group Contribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                <div>
                  <Label htmlFor="auto_approve">Auto-approve requests</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <input
                      type="checkbox"
                      id="auto_approve"
                      checked={formData.auto_approve || false}
                      onChange={(e) => handleInputChange('auto_approve', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="auto_approve" className="text-sm text-muted-foreground">
                      Skip approval queue and automatically approve requests
                    </label>
                  </div>
                </div>

                <div>
                <Label htmlFor="assigned_to">Available to</Label>
                <MultiSelectAssignees
                  familyMembers={familyMembers}
                  selectedAssignees={formData.assigned_to || []}
                  onAssigneesChange={(assignees) => handleInputChange('assigned_to', assignees.length > 0 ? assignees : null)}
                  placeholder="Select family members (leave empty for everyone)"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.reward_type === 'group_contribution' 
                    ? 'All selected members must contribute points together'
                    : 'Leave empty to make available to all family members'
                  }
                </p>
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

      {/* Existing Rewards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Manage Rewards
        </h2>
        
        {/* Show active and inactive rewards */}
        <div className="space-y-6">
          {/* Active Rewards */}
          <div>
            <h3 className="text-lg font-medium mb-4">Active Rewards</h3>
            {rewards.filter(r => r.is_active).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Gift className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Rewards</h3>
                  <p className="text-muted-foreground text-center">
                    Create your first reward to motivate your family members!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.filter(r => r.is_active).map((reward: Reward) => (
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
                         <div className="flex items-center gap-2 flex-wrap">
                           <Badge variant={reward.reward_type === 'once_off' ? 'outline' : reward.reward_type === 'group_contribution' ? 'destructive' : 'secondary'}>
                             {reward.reward_type === 'once_off' ? 'One-time' : reward.reward_type === 'group_contribution' ? 'Group Goal' : 'Always available'}
                           </Badge>
                           <Badge variant="default">Active</Badge>
                         </div>
                         
                         {/* Show assignees */}
                         <div className="flex items-center gap-2 mt-2">
                           <Users className="w-4 h-4 text-muted-foreground" />
                            {reward.assigned_to && reward.assigned_to.length > 0 ? (
                              <MultiAssigneeAvatarGroup 
                                assignees={familyMembers.filter(member => reward.assigned_to?.includes(member.id))} 
                                maxDisplay={99}
                                size="sm"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">Available to everyone</span>
                            )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingReward(reward)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Rewards */}
          {rewards.filter(r => !r.is_active).length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4 text-muted-foreground">Inactive Rewards</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rewards.filter(r => !r.is_active).map((reward: Reward) => (
                  <Card key={reward.id} className="opacity-75">
                    {reward.image_url && (
                      <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                        <img 
                          src={reward.image_url} 
                          alt={reward.title}
                          className="w-full h-full object-cover grayscale"
                        />
                      </div>
                    )}
                    
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg leading-tight text-muted-foreground">{reward.title}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="flex items-center gap-1 whitespace-nowrap">
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
                         <div className="flex items-center gap-2 flex-wrap">
                           <Badge variant={reward.reward_type === 'once_off' ? 'outline' : reward.reward_type === 'group_contribution' ? 'destructive' : 'secondary'}>
                             {reward.reward_type === 'once_off' ? 'One-time' : reward.reward_type === 'group_contribution' ? 'Group Goal' : 'Always available'}
                           </Badge>
                           <Badge variant="outline">Inactive</Badge>
                         </div>
                         
                         {/* Show assignees */}
                         <div className="flex items-center gap-2 mt-2">
                           <Users className="w-4 h-4 text-muted-foreground" />
                            {reward.assigned_to && reward.assigned_to.length > 0 ? (
                              <MultiAssigneeAvatarGroup 
                                assignees={familyMembers.filter(member => reward.assigned_to?.includes(member.id))} 
                                maxDisplay={99}
                                size="sm"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">Available to everyone</span>
                            )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingReward(reward)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

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
          ) : null}
      </div>

      {/* Edit Reward Dialog */}
      <EditRewardDialog
        reward={editingReward}
        open={!!editingReward}
        onOpenChange={(open) => !open && setEditingReward(null)}
        onUpdate={handleUpdateReward}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingReward} onOpenChange={(open) => !open && setDeletingReward(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reward</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingReward?.title}"? This action cannot be undone and will deactivate the reward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingReward && handleDeleteReward(deletingReward)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
