import { useState } from 'react';
import { RewardCard } from './RewardCard';
import { useRewards } from '@/hooks/useRewards';
import { useChildAuth } from '@/hooks/useChildAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Gift } from 'lucide-react';
import type { Reward } from '@/types/rewards';

export function RewardsGallery() {
  const { rewards, loading, requestReward, getPointsBalance } = useRewards();
  const { selectedChildId, childProfiles } = useChildAuth();
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading rewards...</span>
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <Alert>
        <Gift className="w-4 h-4" />
        <AlertDescription>
          Please select a child profile to view available rewards.
        </AlertDescription>
      </Alert>
    );
  }

  const selectedChild = childProfiles.find(p => p.id === selectedChildId);
  const userBalance = getPointsBalance(selectedChildId);

  // Filter rewards that are available to the selected child
  const availableRewards = rewards.filter((reward: Reward) => {
    // If assigned_to is null, reward is available to all
    if (!reward.assigned_to) return true;
    // If assigned_to contains the child's profile ID
    return reward.assigned_to.includes(selectedChildId);
  });

  const handleRequestReward = async (rewardId: string) => {
    if (!selectedChildId) return;
    
    setRequestingIds(prev => new Set(prev).add(rewardId));
    try {
      await requestReward(rewardId, selectedChildId);
    } finally {
      setRequestingIds(prev => {
        const next = new Set(prev);
        next.delete(rewardId);
        return next;
      });
    }
  };

  if (availableRewards.length === 0) {
    return (
      <Alert>
        <Gift className="w-4 h-4" />
        <AlertDescription>
          No rewards are currently available. Check back later!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Available Rewards</h2>
        {selectedChild && (
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>{selectedChild.display_name}'s Balance:</span>
            <div className="flex items-center gap-1 text-primary">
              <Gift className="w-5 h-5" />
              {userBalance} points
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableRewards.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            userBalance={userBalance}
            canRequest={true}
            onRequest={() => handleRequestReward(reward.id)}
            isRequesting={requestingIds.has(reward.id)}
          />
        ))}
      </div>
    </div>
  );
}