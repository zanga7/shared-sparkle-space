import { useState, useEffect } from 'react';
import { RewardCard } from './RewardCard';
import { GroupContributionCard } from './GroupContributionCard';
import { useRewards } from '@/hooks/useRewards';
import { useChildAuth } from '@/hooks/useChildAuth';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Users, User, Crown, Coins, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Reward, GroupContribution } from '@/types/rewards';

interface Profile {
  id: string;
  display_name: string;
  user_id: string | null;
  role: string;
  color: string;
}

export function RewardsGallery({ selectedMemberId }: { selectedMemberId?: string | null }) {
  const { rewards, rewardRequests, loading, requestReward, cancelRewardRequest, getPointsBalance } = useRewards();
  const { selectedChildId, childProfiles, isChildAuthenticated } = useChildAuth();
  const { user } = useAuth();
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
  const [contributingIds, setContributingIds] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [groupContributions, setGroupContributions] = useState<GroupContribution[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<any[]>([]);

  // Fetch user profile and family members for parent view
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        setProfilesLoading(true);
        
        // Get current user's profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, user_id, role, color')
          .eq('user_id', user.id)
          .single();

        if (profileError) throw profileError;
        setUserProfile(profile);

        // If user is a parent, get all family profiles
        if (profile.role === 'parent') {
          const { data: familyProfiles, error: familyError } = await supabase
            .from('profiles')
            .select('id, display_name, user_id, role, color')
            .eq('family_id', (await supabase
              .from('profiles')
              .select('family_id')
              .eq('user_id', user.id)
              .single()).data?.family_id);

          if (familyError) throw familyError;
          setAllProfiles(familyProfiles || []);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setProfilesLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Determine current view state
  const isParentView = userProfile?.role === 'parent';
  const isChildView = selectedChildId && isChildAuthenticated;
  const isMemberFilterView = selectedMemberId && allProfiles.length > 0;
  
  // Get the current profile ID based on context
  const currentProfileId = isMemberFilterView 
    ? selectedMemberId 
    : isChildView 
    ? selectedChildId 
    : userProfile?.id;

  // Get available rewards for current context
  const availableRewards = rewards.filter((reward: Reward) => {
    if (!reward.is_active) return false;
    if (!currentProfileId) return false;
    // If assigned_to is null, reward is available to all
    if (!reward.assigned_to) return true;
    // If assigned_to contains the current profile ID
    return reward.assigned_to.includes(currentProfileId);
  });

  // Fetch group contributions - shared between parent and child views
  const fetchGroupContributions = async () => {
    try {
      const rewardIds = availableRewards
        .filter(r => r.reward_type === 'group_contribution')
        .map(r => r.id);

      if (rewardIds.length === 0) return;

      // Fetch contributions first
      const { data: contributions, error: contribError } = await supabase
        .from('group_contributions')
        .select('*')
        .in('reward_id', rewardIds);

      if (contribError) throw contribError;

      // Fetch profiles for contributors
      const profileIds = [...new Set(contributions?.map(c => c.profile_id) || [])];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, color')
        .in('id', profileIds);

      if (profileError) throw profileError;

      // Combine the data
      const contributionsWithProfiles = contributions?.map(contribution => ({
        ...contribution,
        contributor: profiles?.find(p => p.id === contribution.profile_id)
      })) || [];

      setGroupContributions(contributionsWithProfiles as GroupContribution[]);
    } catch (error) {
      console.error('Error fetching group contributions:', error);
    }
  };

  // Get reward requests for the selected member
  const getMemberRewardRequests = (profileId: string) => {
    return rewardRequests.filter(req => req.requested_by === profileId);
  };

  // Update group contributions when available rewards change
  useEffect(() => {
    if (availableRewards.length > 0) {
      fetchGroupContributions();
    }
  }, [availableRewards.length]); // Use length to avoid infinite loops


  if (loading || profilesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading rewards...</span>
      </div>
    );
  }

  const handleRequestReward = async (rewardId: string) => {
    if (!currentProfileId) return;
    
    setRequestingIds(prev => new Set(prev).add(rewardId));
    try {
      await requestReward(rewardId, currentProfileId);
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
    if (!currentProfileId) return;
    
    // Check if user has already contributed to this reward
    const existingContribution = groupContributions.find(
      c => c.reward_id === rewardId && c.profile_id === currentProfileId
    );
    
    if (existingContribution) {
      toast.error('You have already contributed to this reward');
      return;
    }
    
    setContributingIds(prev => new Set(prev).add(rewardId));
    try {
      // Create contribution entry
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', currentProfileId)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('group_contributions')
        .insert({
          reward_id: rewardId,
          profile_id: currentProfileId,
          family_id: profile.family_id,
          points_contributed: amount
        });

      if (error) throw error;

      // Create ledger entry for spending points
      await supabase
        .from('points_ledger')
        .insert({
          profile_id: currentProfileId,
          family_id: profile.family_id,
          entry_type: 'spend',
          points: -amount,
          reason: `Group contribution to reward`,
          created_by: currentProfileId
        });

      toast.success(`Contributed ${amount} points successfully`);
      fetchGroupContributions(); // Refresh contributions
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

  // For member filter view - show rewards for specific member
  if (isMemberFilterView) {
    const selectedMember = allProfiles.find(p => p.id === selectedMemberId);
    const userBalance = getPointsBalance(selectedMemberId!);
    const memberRequests = getMemberRewardRequests(selectedMemberId!);
    const pendingRequests = memberRequests.filter(req => req.status === 'pending');
    const deniedRequests = memberRequests.filter(req => req.status === 'denied');
    const approvedRequests = memberRequests.filter(req => req.status === 'approved');
    const claimedRequests = memberRequests.filter(req => req.status === 'claimed');

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">
              Rewards for {selectedMember?.display_name}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>Balance:</span>
            <div className="flex items-center gap-1 text-primary">
              <Gift className="w-5 h-5" />
              {userBalance} points
            </div>
          </div>
        </div>

        {availableRewards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Gift className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Rewards Available</h3>
              <p className="text-sm text-muted-foreground text-center">
                No rewards are currently available for {selectedMember?.display_name}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRewards.map((reward) => {
                if (reward.reward_type === 'group_contribution') {
                  const rewardContributions = groupContributions.filter(c => c.reward_id === reward.id);
                  return (
                    <GroupContributionCard
                      key={reward.id}
                      reward={reward}
                      userBalance={userBalance}
                      profileId={selectedMemberId!}
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
                  />
                );
              })}
            </div>

            {/* Member reward history */}
            {(pendingRequests.length > 0 || deniedRequests.length > 0 || approvedRequests.length > 0 || claimedRequests.length > 0) && (
              <div className="mt-8 space-y-6">
                {/* Waiting approval section */}
                {pendingRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      Waiting Approval ({pendingRequests.length})
                    </h3>
                    <div className="space-y-2">
                       {pendingRequests.map((request) => (
                         <div key={request.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                           <div>
                             <p className="font-medium text-sm">{request.reward?.title}</p>
                             <p className="text-xs text-muted-foreground">
                               Requested {format(new Date(request.created_at), 'PP')} • {request.points_cost} points
                             </p>
                           </div>
                           <div className="flex items-center gap-2">
                             <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                               Pending
                             </Badge>
                             <Button 
                               size="sm" 
                               variant="outline" 
                               onClick={() => handleCancelRequest(request.id)}
                               className="text-xs"
                             >
                               Cancel
                             </Button>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {/* Denied rewards section */}
                {deniedRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-500" />
                      Denied ({deniedRequests.length})
                    </h3>
                    <div className="space-y-2">
                      {deniedRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{request.reward?.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Denied {format(new Date(request.updated_at), 'PP')} • {request.points_cost} points
                            </p>
                            {request.approval_note && (
                              <p className="text-xs text-red-600 mt-1">Note: {request.approval_note}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            Denied
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approved rewards section */}
                {approvedRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Approved ({approvedRequests.length})
                    </h3>
                    <div className="space-y-2">
                      {approvedRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{request.reward?.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Approved {format(new Date(request.updated_at), 'PP')} • {request.points_cost} points
                            </p>
                            {request.approval_note && (
                              <p className="text-xs text-green-600 mt-1">Note: {request.approval_note}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Approved
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claimed rewards section */}
                {claimedRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Claimed ({claimedRequests.length})
                    </h3>
                    <div className="space-y-2">
                      {claimedRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{request.reward?.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Claimed {format(new Date(request.updated_at), 'PP')} • {request.points_cost} points
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Claimed
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // For parent dashboard - show rewards they can claim
  if (isParentView && !isChildView) {
    const userBalance = getPointsBalance(userProfile.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">Available Rewards</h2>
          </div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>Your Balance:</span>
            <div className="flex items-center gap-1 text-primary">
              <Gift className="w-5 h-5" />
              {userBalance} points
            </div>
          </div>
        </div>

        {availableRewards.length === 0 ? (
          <Alert>
            <Gift className="w-4 h-4" />
            <AlertDescription>
              No rewards are currently available for you. Check back later or earn more points!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableRewards.map((reward) => {
              if (reward.reward_type === 'group_contribution') {
                const rewardContributions = groupContributions.filter(c => c.reward_id === reward.id);
                return (
                  <GroupContributionCard
                    key={reward.id}
                    reward={reward}
                    userBalance={userBalance}
                    profileId={userProfile.id}
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
                  canRequest={true}
                  onRequest={() => handleRequestReward(reward.id)}
                  isRequesting={requestingIds.has(reward.id)}
                />
              );
            })}
          </div>
        )}

      </div>
    );
  }

  // Child View - Show rewards they can request
  if (isChildView) {
    const selectedChild = childProfiles.find(p => p.id === selectedChildId);
    const userBalance = getPointsBalance(selectedChildId);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">Available Rewards</h2>
          </div>
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

        {availableRewards.length === 0 ? (
          <Alert>
            <Gift className="w-4 h-4" />
            <AlertDescription>
              No rewards are currently available for you. Check back later or earn more points!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableRewards.map((reward) => {
              if (reward.reward_type === 'group_contribution') {
                const rewardContributions = groupContributions.filter(c => c.reward_id === reward.id);
                return (
                  <GroupContributionCard
                    key={reward.id}
                    reward={reward}
                    userBalance={userBalance}
                    profileId={selectedChildId}
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
                  canRequest={true}
                  onRequest={() => handleRequestReward(reward.id)}
                  isRequesting={requestingIds.has(reward.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default view for unauthenticated child
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <User className="w-16 h-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold mb-2">Select a Child Profile</h2>
      <p className="text-muted-foreground max-w-md">
        Please select a child profile from the sidebar to view available rewards.
      </p>
    </div>
  );
}