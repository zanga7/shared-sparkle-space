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
      const { data, error } = await supabase
        .from('reward_requests')
        .select(`
          *,
          rewards!inner(*),
          profiles!reward_requests_requested_by_fkey(id, display_name, color)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our types
      const transformedData = (data || []).map(item => ({
        ...item,
        reward: Array.isArray(item.rewards) ? item.rewards[0] : item.rewards,
        requestor: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      }));
      
      setRewardRequests(transformedData as RewardRequest[]);
    } catch (error) {
      console.error('Error fetching reward requests:', error);
      toast.error('Failed to load reward requests');
    }
  };

  // Fetch points balances for all family members
  const fetchPointsBalances = async () => {
    if (!user) return;

    try {
      // Get all family members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .order('sort_order');

      if (profilesError) throw profilesError;

      // Get balance for each profile
      const balances: PointsBalance[] = [];
      for (const profile of profiles || []) {
        const { data: balanceData, error: balanceError } = await supabase
          .rpc('get_profile_points_balance', { profile_id_param: profile.id });

        if (balanceError) throw balanceError;
        balances.push({
          profile_id: profile.id,
          balance: balanceData || 0
        });
      }

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
        .rpc('update_reward', {
          reward_id_param: rewardId,
          title_param: rewardData.title || '',
          description_param: rewardData.description || '',
          cost_points_param: rewardData.cost_points || 0,
          reward_type_param: rewardData.reward_type || 'always_available',
          image_url_param: rewardData.image_url || '',
          is_active_param: rewardData.is_active !== undefined ? rewardData.is_active : true
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update reward');
      }

      toast.success('Reward updated successfully');
      await fetchRewards();
    } catch (error) {
      console.error('Error updating reward:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update reward');
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

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete reward');
      }

      toast.success('Reward deleted successfully');
      await fetchRewards();
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
    addPointsAdjustment,
    getPointsBalance,
    refreshData: () => Promise.all([fetchRewards(), fetchRewardRequests(), fetchPointsBalances()])
  };
}