import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Reward, RewardRequest, PointsLedgerEntry, PointsBalance } from '@/types/rewards';

export function useRewards() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [pointsBalances, setPointsBalances] = useState<PointsBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch active rewards
  const fetchRewards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRewards((data || []) as Reward[]);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      toast.error('Failed to load rewards');
    }
  };

  // Fetch reward requests
  const fetchRewardRequests = async () => {
    if (!user) return;

    try {
      // First get the raw reward requests
      const { data: requests, error } = await supabase
        .from('reward_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Reward requests not available yet:', error.message);
        setRewardRequests([]);
        return;
      }

      if (!requests || requests.length === 0) {
        setRewardRequests([]);
        return;
      }

      // Get all unique reward IDs and profile IDs
      const rewardIds = [...new Set(requests.map(req => req.reward_id))];
      const profileIds = [...new Set(requests.map(req => req.requested_by))];

      // Fetch rewards and profiles in parallel
      const [rewardsData, profilesData] = await Promise.all([
        supabase.from('rewards').select('id, title, description, cost_points').in('id', rewardIds),
        supabase.from('profiles').select('id, display_name, color').in('id', profileIds)
      ]);

      // Create lookup maps
      const rewardsMap = new Map();
      const profilesMap = new Map();

      if (rewardsData.data) {
        rewardsData.data.forEach(reward => rewardsMap.set(reward.id, reward));
      }

      if (profilesData.data) {
        profilesData.data.forEach(profile => profilesMap.set(profile.id, profile));
      }

      // Combine the data
      const enrichedRequests = requests.map(request => ({
        ...request,
        reward: rewardsMap.get(request.reward_id) || null,
        requestor: profilesMap.get(request.requested_by) || null
      }));
      
      setRewardRequests(enrichedRequests as RewardRequest[]);
    } catch (error) {
      console.log('Reward requests functionality not available yet');
      setRewardRequests([]);
    }
  };

  // Fetch points balances for all family members
  const fetchPointsBalances = async () => {
    if (!user) return;

    try {
      // Get all family members with their total_points directly from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, total_points')
        .order('sort_order');

      if (profilesError) throw profilesError;

      // Map the profiles to PointsBalance format
      const balances: PointsBalance[] = (profiles || []).map(profile => ({
        profile_id: profile.id,
        balance: profile.total_points || 0
      }));

      setPointsBalances(balances);
    } catch (error) {
      console.error('Error fetching points balances:', error);
      toast.error('Failed to load points balances');
    }
  };

  // Create a new reward
  const createReward = async (rewardData: Omit<Reward, 'id' | 'family_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('rewards')
        .insert({
          ...rewardData,
          family_id: profile.family_id,
          created_by: profile.id
        });

      if (error) throw error;

      toast.success('Reward created successfully');
      await fetchRewards();
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error('Failed to create reward');
    }
  };

  // Update an existing reward
  const updateReward = async (rewardId: string, rewardData: Partial<Omit<Reward, 'id' | 'family_id' | 'created_by' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('rewards')
        .update({
          title: rewardData.title,
          description: rewardData.description || null,
          cost_points: rewardData.cost_points,
          reward_type: rewardData.reward_type,
          image_url: rewardData.image_url || null,
          is_active: rewardData.is_active,
          assigned_to: rewardData.assigned_to
        })
        .eq('id', rewardId);

      if (error) throw error;

      toast.success('Reward updated successfully');
      // Don't call fetchRewards here - let the component handle refresh
      // await fetchRewards();
    } catch (error) {
      console.error('Error updating reward:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update reward');
      throw error;
    }
  };

  // Delete a reward
  const deleteReward = async (rewardId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('delete_reward', {
          reward_id_param: rewardId
        });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete reward');
      }

      toast.success('Reward deleted successfully');
      // Don't call fetchRewards here - let the component handle refresh
    } catch (error) {
      console.error('Error deleting reward:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete reward');
    }
  };

  // Request a reward
  const requestReward = async (rewardId: string, profileId: string) => {
    try {
      const reward = rewards.find(r => r.id === rewardId);
      if (!reward) throw new Error('Reward not found');

      const { error } = await supabase
        .from('reward_requests')
        .insert({
          reward_id: rewardId,
          requested_by: profileId,
          points_cost: reward.cost_points
        });

      if (error) throw error;

      toast.success('Reward request submitted');
      await fetchRewardRequests();
    } catch (error) {
      console.error('Error requesting reward:', error);
      toast.error('Failed to request reward');
    }
  };

  // Approve a reward request
  const approveRewardRequest = async (requestId: string, note?: string) => {
    try {
      const { data, error } = await supabase
        .rpc('approve_reward_request', {
          request_id_param: requestId,
          approval_note_param: note
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve request');
      }

      toast.success('Reward request approved');
      await Promise.all([fetchRewardRequests(), fetchPointsBalances()]);
    } catch (error) {
      console.error('Error approving reward request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve request');
    }
  };

  // Deny a reward request
  const denyRewardRequest = async (requestId: string, note?: string) => {
    try {
      const { data, error } = await supabase
        .rpc('deny_reward_request', {
          request_id_param: requestId,
          denial_note_param: note
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to deny request');
      }

      toast.success('Reward request denied');
      await fetchRewardRequests();
    } catch (error) {
      console.error('Error denying reward request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deny request');
    }
  };

  // Cancel a reward request (by the requester)
  const cancelRewardRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('reward_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Reward request cancelled');
      await fetchRewardRequests();
    } catch (error) {
      console.error('Error cancelling reward request:', error);
      toast.error('Failed to cancel request');
    }
  };

  // Add points adjustment
  const addPointsAdjustment = async (profileId: string, points: number, reason: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('points_ledger')
        .insert({
          profile_id: profileId,
          family_id: profile.family_id,
          entry_type: 'adjust',
          points,
          reason,
          created_by: profile.id
        });

      if (error) throw error;

      toast.success(`Points ${points > 0 ? 'added' : 'deducted'} successfully`);
      await fetchPointsBalances();
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast.error('Failed to adjust points');
    }
  };

  // Get points balance for a specific profile
  const getPointsBalance = (profileId: string): number => {
    return pointsBalances.find(b => b.profile_id === profileId)?.balance || 0;
  };

  const refreshData = async () => {
    await Promise.all([fetchRewards(), fetchRewardRequests(), fetchPointsBalances()]);
  };

  // Revoke reward request and refund points
  const revokeRewardRequest = async (requestId: string, note?: string): Promise<void> => {
    try {
      const { data, error } = await supabase.rpc('revoke_reward_request', {
        request_id_param: requestId,
        revoke_note_param: note
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) throw new Error(result.error);

      toast.success('Reward revoked and points refunded');
      await refreshData();
    } catch (error) {
      console.error('Error revoking reward:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke reward');
    }
  };

  // Mark reward as claimed
  const markRewardClaimed = async (requestId: string): Promise<void> => {
    try {
      const { data, error } = await supabase.rpc('mark_reward_claimed', {
        request_id_param: requestId
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) throw new Error(result.error);

      toast.success('Reward marked as claimed');
      await refreshData();
    } catch (error) {
      console.error('Error marking reward as claimed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mark reward as claimed');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRewards(),
        fetchRewardRequests(),
        fetchPointsBalances()
      ]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user]);

  return {
    rewards,
    rewardRequests,
    pointsBalances,
    loading,
    createReward,
    updateReward,
    deleteReward,
    requestReward,
    approveRewardRequest,
    denyRewardRequest,
    cancelRewardRequest,
    revokeRewardRequest,
    markRewardClaimed,
    addPointsAdjustment,
    getPointsBalance,
    refreshData
  };
}