import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingStatus() {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get user's family_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.family_id) {
        setNeedsOnboarding(true);
        setLoading(false);
        return;
      }

      setFamilyId(profile.family_id);

      // Check household settings for onboarding status
      const { data: settings } = await supabase
        .from('household_settings')
        .select('onboarding_completed')
        .eq('family_id', profile.family_id)
        .single();

      setNeedsOnboarding(!(settings as any)?.onboarding_completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!familyId) return;

    try {
      await supabase
        .from('household_settings')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('family_id', familyId);

      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  return {
    needsOnboarding,
    loading,
    completeOnboarding,
    refreshStatus: checkOnboardingStatus
  };
}
