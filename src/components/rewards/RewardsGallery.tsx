
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
import { Loader2, Gift, Users, User, Crown } from 'lucide-react';
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

export function RewardsGallery() {
  const { rewards, loading, requestReward, getPointsBalance } = useRewards();
  const { selectedChildId, childProfiles, isChildAuthenticated } = useChildAuth();
  const { user } = useAuth();
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());
  const [contributingIds, setContributingIds] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [groupContributions, setGroupContributions] = useState<GroupContribution[]>([]);

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

  if (loading || profilesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading rewards...</span>
      </div>
    );
  }

  // Determine if this is a parent or child view
  const isParentView = userProfile?.role === 'parent';
  const isChildView = selectedChildId && isChildAuthenticated;

  // For parent dashboard - show rewards they can claim
  if (isParentView && !isChildView) {
    const userBalance = getPointsBalance(userProfile.id);
    
    // Filter rewards that are available to the parent user
    const availableRewards = rewards.filter((reward: Reward) => {
      if (!reward.is_active) return false;
      // If assigned_to is null, reward is available to all
      if (!reward.assigned_to) return true;
      // If assigned_to contains the parent's profile ID
      return reward.assigned_to.includes(userProfile.id);
    });

    const handleRequestReward = async (rewardId: string) => {
      if (!userProfile) return;
      
      setRequestingIds(prev => new Set(prev).add(rewardId));
      try {
        await requestReward(rewardId, userProfile.id);
      } finally {
        setRequestingIds(prev => {
          const next = new Set(prev);
          next.delete(rewardId);
          return next;
        });
      }
    };

    const handleGroupContribution = async (rewardId: string, amount: number) => {
      if (!userProfile) return;
      
      setContributingIds(prev => new Set(prev).add(rewardId));
      try {
        // Create contribution entry
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('id', userProfile.id)
          .single();

        if (!profile) throw new Error('Profile not found');

        const { error } = await supabase
          .from('group_contributions')
          .insert({
            reward_id: rewardId,
            profile_id: userProfile.id,
            family_id: profile.family_id,
            points_contributed: amount
          });

        if (error) throw error;

        // Create ledger entry for spending points
        await supabase
          .from('points_ledger')
          .insert({
            profile_id: userProfile.id,
            family_id: profile.family_id,
            entry_type: 'spend',
            points: -amount,
            reason: `Group contribution to reward`,
            created_by: userProfile.id
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

    // Fetch group contributions for available rewards
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

    // Fetch contributions when available rewards change
    useEffect(() => {
      fetchGroupContributions();
    }, [availableRewards]);

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

        {/* Management View Toggle */}
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">All Family Rewards (Management View)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <Card key={reward.id} className="relative">
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
                    <Badge variant="outline" className="flex items-center gap-1 whitespace-nowrap">
                      <Gift className="w-3 h-3" />
                      {reward.cost_points} pts
                    </Badge>
                  </div>
                  {reward.description && (
                    <CardDescription>{reward.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-2">Available to:</p>
                      {!reward.assigned_to || reward.assigned_to.length === 0 ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Users className="w-3 h-3" />
                          All family members
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {reward.assigned_to.map(profileId => {
                            const profile = allProfiles.find(p => p.id === profileId);
                            return profile ? (
                              <Badge key={profileId} variant="outline" className="text-xs">
                                {profile.display_name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Type: {
                        reward.reward_type === 'once_off' ? 'One-time' : 
                        reward.reward_type === 'group_contribution' ? 'Group Goal' : 
                        'Always available'
                      }</span>
                      <span>Status: {reward.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Child View - Show rewards they can request
  if (isChildView) {
    const selectedChild = childProfiles.find(p => p.id === selectedChildId);
    const userBalance = getPointsBalance(selectedChildId);

    // Filter rewards that are available to the selected child
    const availableRewards = rewards.filter((reward: Reward) => {
      if (!reward.is_active) return false;
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

    const handleGroupContribution = async (rewardId: string, amount: number) => {
      if (!selectedChildId) return;
      
      setContributingIds(prev => new Set(prev).add(rewardId));
      try {
        // Create contribution entry
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('id', selectedChildId)
          .single();

        if (!profile) throw new Error('Profile not found');

        const { error } = await supabase
          .from('group_contributions')
          .insert({
            reward_id: rewardId,
            profile_id: selectedChildId,
            family_id: profile.family_id,
            points_contributed: amount
          });

        if (error) throw error;

        // Create ledger entry for spending points
        await supabase
          .from('points_ledger')
          .insert({
            profile_id: selectedChildId,
            family_id: profile.family_id,
            entry_type: 'spend',
            points: -amount,
            reason: `Group contribution to reward`,
            created_by: selectedChildId
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

    // Fetch group contributions for available rewards
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

    // Fetch contributions when available rewards change
    useEffect(() => {
      fetchGroupContributions();
    }, [availableRewards]);

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

  // Show child selection interface for non-parents
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User className="w-6 h-6 text-blue-500" />
        <h2 className="text-2xl font-bold">Select Child Profile</h2>
      </div>
      <Alert>
        <Gift className="w-4 h-4" />
        <AlertDescription>
          Please select and authenticate a child profile to view and claim available rewards.
        </AlertDescription>
      </Alert>
    </div>
  );
}
