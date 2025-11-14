import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DashboardModeSettings {
  dashboard_mode_enabled: boolean;
  auto_return_timeout?: number;
  require_parent_pin_for_dashboard?: boolean;
}

export function useDashboardMode() {
  const { user } = useAuth();
  const [dashboardModeEnabled, setDashboardModeEnabled] = useState<boolean>(false);
  const [requireParentPin, setRequireParentPin] = useState<boolean>(false);
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
          .select('dashboard_mode_enabled, require_parent_pin_for_dashboard')
          .eq('family_id', familyId)
          .single();

        if (error) {
          console.error('Error loading dashboard mode:', error);
          setDashboardModeEnabled(false);
          setRequireParentPin(false);
        } else if (data) {
          setDashboardModeEnabled((data as any).dashboard_mode_enabled || false);
          setRequireParentPin((data as any).require_parent_pin_for_dashboard || false);
        }
      } catch (error) {
        console.error('Error in useDashboardMode:', error);
        setDashboardModeEnabled(false);
        setRequireParentPin(false);
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
      .select('dashboard_mode_enabled, require_parent_pin_for_dashboard')
      .eq('family_id', familyId)
      .single();

    if (data) {
      setDashboardModeEnabled((data as any).dashboard_mode_enabled || false);
      setRequireParentPin((data as any).require_parent_pin_for_dashboard || false);
    }
  };

  return {
    dashboardModeEnabled,
    requireParentPin,
    loading,
    refreshSettings
  };
}
