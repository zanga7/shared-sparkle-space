import { useState, useEffect } from 'react';
import { RewardCard } from './RewardCard';
import { useRewards } from '@/hooks/useRewards';
import { useChildAuth } from '@/hooks/useChildAuth';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Users, User, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Reward } from '@/types/rewards';

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
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

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
  const isChildView = !isParentView && selectedChildId;

  // Parent View - Show all rewards with assignment info
  if (isParentView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">Family Rewards Management</h2>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Parent View
          </Badge>
        </div>

        {rewards.length === 0 ? (
          <Alert>
            <Gift className="w-4 h-4" />
            <AlertDescription>
              No rewards have been created yet. Visit the admin panel to create rewards for your family.
            </AlertDescription>
          </Alert>
        ) : (
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
        )}
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
        )}
      </div>
    );
  }

  // Neither parent nor child authenticated - show child selection
  return (
    <Alert>
      <Gift className="w-4 h-4" />
      <AlertDescription>
        Please log in as a parent to manage rewards, or select and authenticate a child profile to view available rewards.
      </AlertDescription>
    </Alert>
  );
}