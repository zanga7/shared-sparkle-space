import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  user_id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
  total_points: number;
  avatar_url?: string | null;
  can_add_for_self: boolean;
  can_add_for_siblings: boolean;
  can_add_for_parents: boolean;
  status: string;
  color: string;
  streak_count: number;
  pin_type?: string | null;
  theme?: any;
  created_at: string;
  updated_at: string;
  sort_order?: number | null;
  require_pin_to_complete_tasks?: boolean;
  require_pin_for_list_deletes?: boolean;
  calendar_edit_permission?: string;
}

interface FamilyMember extends Profile {
  require_pin_to_complete_tasks?: boolean;
  require_pin_for_list_deletes?: boolean;
  calendar_edit_permission?: string;
}

interface AdminContextType {
  profile: Profile | null;
  familyMembers: FamilyMember[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshFamilyMembers: () => Promise<void>;
  isParent: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const useAdminContext = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, family_id, display_name, role, total_points, avatar_url, can_add_for_self, can_add_for_siblings, can_add_for_parents, status, color, streak_count, theme, created_at, updated_at, sort_order, pin_type, require_pin_to_complete_tasks, require_pin_for_list_deletes, calendar_edit_permission')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      setProfile(data);
      
      // Fetch family members once we have the profile
      if (data?.family_id) {
        await fetchFamilyMembers(data.family_id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyMembers = async (familyId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, family_id, display_name, role, total_points, avatar_url, can_add_for_self, can_add_for_siblings, can_add_for_parents, status, color, streak_count, theme, created_at, updated_at, sort_order, pin_type, require_pin_to_complete_tasks, require_pin_for_list_deletes, calendar_edit_permission')
        .eq('family_id', familyId)
        .order('role', { ascending: false }) // Parents first
        .order('display_name');
      
      if (error) throw error;
      setFamilyMembers(data || []);
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile();
  };

  const refreshFamilyMembers = async () => {
    if (!profile?.family_id) return;
    await fetchFamilyMembers(profile.family_id);
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setFamilyMembers([]);
      setLoading(false);
    }
  }, [user]);

  const isParent = profile?.role === 'parent';

  return (
    <AdminContext.Provider value={{
      profile,
      familyMembers,
      loading,
      refreshProfile,
      refreshFamilyMembers,
      isParent
    }}>
      {children}
    </AdminContext.Provider>
  );
};