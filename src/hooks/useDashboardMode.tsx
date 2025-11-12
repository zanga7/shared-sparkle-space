import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DashboardModeSettings {
  dashboard_mode_enabled: boolean;
  auto_return_timeout?: number;
}

export function useDashboardMode() {
  const { user } = useAuth();
  const [dashboardModeEnabled, setDashboardModeEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Fetch user's family_id
  useEffect(() => {
    const fetchFamilyId = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setFamilyId(profile.family_id);
      }
    };

    fetchFamilyId();
  }, [user]);

  // Fetch dashboard mode setting
  useEffect(() => {
    const loadDashboardMode = async () => {
      if (!familyId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('household_settings')
          .select('dashboard_mode_enabled')
          .eq('family_id', familyId)
          .single();

        if (error) {
          console.error('Error loading dashboard mode:', error);
          setDashboardModeEnabled(false);
        } else {
          setDashboardModeEnabled(data?.dashboard_mode_enabled || false);
        }
      } catch (error) {
        console.error('Error in useDashboardMode:', error);
        setDashboardModeEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardMode();
  }, [familyId]);

  const refreshSettings = async () => {
    if (!familyId) return;

    const { data } = await supabase
      .from('household_settings')
      .select('dashboard_mode_enabled')
      .eq('family_id', familyId)
      .single();

    if (data) {
      setDashboardModeEnabled(data.dashboard_mode_enabled || false);
    }
  };

  return {
    dashboardModeEnabled,
    loading,
    refreshSettings
  };
}
