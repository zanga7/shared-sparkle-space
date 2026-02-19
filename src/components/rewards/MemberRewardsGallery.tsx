import { useState, useEffect } from 'react';
import { RewardCard } from './RewardCard';
import { GroupContributionCard } from './GroupContributionCard';
import { useRewards } from '@/hooks/useRewards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { GroupContribution } from '@/types/rewards';
import { Profile } from '@/types/task';
import { cn } from '@/lib/utils';
import { useMemberColor } from '@/hooks/useMemberColor';

interface MemberRewardsGalleryProps {
  member: Profile;
}

export function MemberRewardsGallery({ member }: MemberRewardsGalleryProps) {
  const { rewards, rewardRequests, loading, requestReward, cancelRewardRequest, getPointsBalance } = useRewards();
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
  const [contributingIds, setContributingIds] = useState<Set<string>>(new Set());
  const [groupContributions, setGroupContributions] = useState<GroupContribution[]>([]);
  
  const { styles: colorStyles } = useMemberColor(member.color);
  const userBalance = getPointsBalance(member.id);

  // Get available rewards for this member
  const availableRewards = rewards.filter(reward => {
    if (!reward.is_active) return false;
    if (!reward.assigned_to) return true;
    return reward.assigned_to.includes(member.id);
  });

  // Get member's reward requests
  const memberRequests = rewardRequests.filter(req => req.requested_by === member.id);
  const pendingRequests = memberRequests.filter(req => req.status === 'pending');
  const deniedRequests = memberRequests.filter(req => req.status === 'denied');
  const approvedRequests = memberRequests.filter(req => req.status === 'approved');
  const claimedRequests = memberRequests.filter(req => req.status === 'claimed');

  // Fetch group contributions
  const fetchGroupContributions = async () => {
    try {
      const rewardIds = availableRewards
        .filter(r => r.reward_type === 'group_contribution')
        .map(r => r.id);

      if (rewardIds.length === 0) return;

      const { data: contributions, error: contribError } = await supabase
        .from('group_contributions')
        .select('*')
        .in('reward_id', rewardIds);

      if (contribError) throw contribError;

      const profileIds = [...new Set(contributions?.map(c => c.profile_id) || [])];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, color')
        .in('id', profileIds);

      if (profileError) throw profileError;

      const contributionsWithProfiles = contributions?.map(contribution => ({
        ...contribution,
        contributor: profiles?.find(p => p.id === contribution.profile_id)
      })) || [];

      setGroupContributions(contributionsWithProfiles as GroupContribution[]);
    } catch (error) {
      console.error('Error fetching group contributions:', error);
    }
  };

  useEffect(() => {
    if (availableRewards.length > 0) {
      fetchGroupContributions();
    }
  }, [availableRewards.length]);

  const handleRequestReward = async (rewardId: string) => {
    setRequestingIds(prev => new Set(prev).add(rewardId));
    try {
      await requestReward(rewardId, member.id);
    } finally {
      setRequestingIds(prev => {
        const next = new Set(prev);
        next.delete(rewardId);
        return next;
      });
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelRewardRequest(requestId);
      toast.success('Reward request cancelled');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    }
  };

  const handleGroupContribution = async (rewardId: string, amount: number) => {
    const existingContribution = groupContributions.find(
      c => c.reward_id === rewardId && c.profile_id === member.id
    );
    
    if (existingContribution) {
      toast.error('You have already contributed to this reward');
      return;
    }
    
    setContributingIds(prev => new Set(prev).add(rewardId));
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', member.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // First, get current points balance
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', member.id)
        .single();

      if (fetchError || !currentProfile) throw new Error('Failed to get current points balance');

      // Check if user has enough points
      if (currentProfile.total_points < amount) {
        toast.error('Insufficient points for this contribution');
        return;
      }

      // Deduct points from profile's total_points
      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ total_points: currentProfile.total_points - amount })
        .eq('id', member.id);

      if (pointsError) throw pointsError;

      // Create the contribution record
      const { error } = await supabase
        .from('group_contributions')
        .insert({
          reward_id: rewardId,
          profile_id: member.id,
          family_id: profile.family_id,
          points_contributed: amount
        });

      if (error) throw error;

      // Create ledger entry for audit trail
      await supabase
        .from('points_ledger')
        .insert({
          profile_id: member.id,
          family_id: profile.family_id,
          entry_type: 'spend',
          points: -amount,
          reason: `Group contribution to reward`,
          created_by: member.id
        });

      toast.success(`Contributed ${amount} points successfully`);
      fetchGroupContributions();
    } catch (error) {
      console.error('Error contributing to group reward:', error);
      toast.error('Failed to contribute to reward');
    } finally {
      setContributingIds(prev => {
        const next = new Set(prev);
        next.delete(rewardId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card className="h-full flex flex-col" style={colorStyles.bg10}>
        <CardContent className="flex items-center justify-center py-8 px-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading rewards...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col" style={colorStyles.bg10}>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold flex items-center gap-2" style={colorStyles.text}>
            <Gift className="w-6 h-6" />
            Rewards
          </h3>
          <Badge variant="outline" className="text-sm">
            {userBalance} points
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {availableRewards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground px-3">
            <Gift className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No rewards available</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 grid-gap">
              {availableRewards.map((reward) => {
                if (reward.reward_type === 'group_contribution') {
                  const rewardContributions = groupContributions.filter(c => c.reward_id === reward.id);
                  return (
                    <GroupContributionCard
                      key={reward.id}
                      reward={reward}
                      userBalance={userBalance}
                      profileId={member.id}
                      contributions={rewardContributions}
                      onContribute={(amount) => handleGroupContribution(reward.id, amount)}
                      isContributing={contributingIds.has(reward.id)}
                    />
                  );
                }
                
                return (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userBalance={userBalance}
                    canRequest={userBalance >= reward.cost_points}
                    onRequest={() => handleRequestReward(reward.id)}
                    isRequesting={requestingIds.has(reward.id)}
                    memberColor={member.color}
                  />
                );
              })}
            </div>

            {/* Pending requests section */}
            {pendingRequests.length > 0 && (
              <div className="pt-4 border-t space-y-2 px-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  Pending ({pendingRequests.length})
                </h4>
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{request.reward?.title}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(request.created_at), 'PP')}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleCancelRequest(request.id)}
                      className="h-7 px-2 text-xs ml-2"
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Approved requests section */}
            {approvedRequests.length > 0 && (
              <div className="pt-4 border-t space-y-2 px-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Approved ({approvedRequests.length})
                </h4>
                {approvedRequests.map((request) => (
                  <div key={request.id} className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg text-xs">
                    <p className="font-medium">{request.reward?.title}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(request.updated_at), 'PP')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Denied requests section */}
            {deniedRequests.length > 0 && (
              <div className="pt-4 border-t space-y-2 px-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Denied ({deniedRequests.length})
                </h4>
                {deniedRequests.map((request) => (
                  <div key={request.id} className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg text-xs">
                    <p className="font-medium">{request.reward?.title}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(request.updated_at), 'PP')}
                    </p>
                    {request.approval_note && (
                      <p className="text-red-600 dark:text-red-400 mt-1">{request.approval_note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
