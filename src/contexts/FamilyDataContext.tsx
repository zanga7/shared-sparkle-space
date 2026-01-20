import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface FamilyMember {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  color: string;
  avatar_url: string | null;
  status: string;
  total_points: number;
}

interface Reward {
  id: string;
  title: string;
  description: string | null;
  cost_points: number;
  reward_type: string;
  image_url: string | null;
  is_active: boolean;
}

interface HouseholdSettings {
  dashboard_mode_enabled: boolean;
  require_parent_pin_for_dashboard: boolean;
  completed_tasks_hide_hours: number;
}

interface FamilyDataContextValue {
  familyId: string | null;
  profileId: string | null;
  familyMembers: FamilyMember[];
  rewards: Reward[];
  householdSettings: HouseholdSettings | null;
  isLoading: boolean;
  refetchMembers: () => void;
  refetchRewards: () => void;
  refetchSettings: () => void;
  getMemberById: (id: string) => FamilyMember | undefined;
  getMemberColor: (id: string) => string;
}

const FamilyDataContext = createContext<FamilyDataContextValue | null>(null);

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch user profile to get family_id (only once)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setFamilyId(null);
        setProfileId(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setFamilyId(profile.family_id);
        setProfileId(profile.id);
      }
    };

    fetchProfile();
  }, [user]);

  // Centralized family members query
  const { data: familyMembers = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['family-members', familyId],
    queryFn: async () => {
      if (!familyId) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, color, avatar_url, status, total_points')
        .eq('family_id', familyId)
        .eq('status', 'active')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as FamilyMember[];
    },
    enabled: !!familyId,
    staleTime: 1000 * 60 * 5, // 5 minutes - profiles rarely change
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Centralized rewards query
  const { data: rewards = [], isLoading: rewardsLoading, refetch: refetchRewards } = useQuery({
    queryKey: ['family-rewards', familyId],
    queryFn: async () => {
      if (!familyId) return [];
      
      const { data, error } = await supabase
        .from('rewards')
        .select('id, title, description, cost_points, reward_type, image_url, is_active')
        .eq('family_id', familyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Reward[];
    },
    enabled: !!familyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
  });

  // Centralized household settings query
  const { data: householdSettings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ['household-settings', familyId],
    queryFn: async () => {
      if (!familyId) return null;
      
      const { data, error } = await supabase
        .from('household_settings')
        .select('dashboard_mode_enabled, require_parent_pin_for_dashboard, completed_tasks_hide_hours')
        .eq('family_id', familyId)
        .single();
      
      if (error) throw error;
      return data as HouseholdSettings;
    },
    enabled: !!familyId,
    staleTime: 1000 * 60 * 10, // 10 minutes - settings rarely change
    gcTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Memoized helper to get member by ID
  const getMemberById = useCallback((id: string) => {
    return familyMembers.find(m => m.id === id);
  }, [familyMembers]);

  // Memoized helper to get member color
  const getMemberColor = useCallback((id: string) => {
    return familyMembers.find(m => m.id === id)?.color || '#6b7280';
  }, [familyMembers]);

  const isLoading = membersLoading || rewardsLoading || settingsLoading;

  const value = useMemo(() => ({
    familyId,
    profileId,
    familyMembers,
    rewards,
    householdSettings: householdSettings || null,
    isLoading,
    refetchMembers,
    refetchRewards,
    refetchSettings,
    getMemberById,
    getMemberColor,
  }), [
    familyId,
    profileId,
    familyMembers,
    rewards,
    householdSettings,
    isLoading,
    refetchMembers,
    refetchRewards,
    refetchSettings,
    getMemberById,
    getMemberColor
  ]);

  return (
    <FamilyDataContext.Provider value={value}>
      {children}
    </FamilyDataContext.Provider>
  );
}

export function useFamilyData() {
  const context = useContext(FamilyDataContext);
  if (!context) {
    throw new Error('useFamilyData must be used within a FamilyDataProvider');
  }
  return context;
}

// Optional hook that doesn't throw if outside provider (for gradual migration)
export function useFamilyDataOptional() {
  return useContext(FamilyDataContext);
}
