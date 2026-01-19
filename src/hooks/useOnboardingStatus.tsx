import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingStatus() {
  const { user } = useAuth();

  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Use ref for familyId to avoid dependency cycles in useCallback
  const familyIdRef = useRef<string | null>(null);

  const fetchFamilyId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile family_id:', error);
      return null;
    }

    return profile?.family_id ?? null;
  }, [user]);

  const checkOnboardingStatus = useCallback(async () => {
    if (!user) {
      familyIdRef.current = null;
      setNeedsOnboarding(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const resolvedFamilyId = familyIdRef.current ?? (await fetchFamilyId());

      if (!resolvedFamilyId) {
        familyIdRef.current = null;
        setNeedsOnboarding(true);
        return;
      }

      familyIdRef.current = resolvedFamilyId;

      const { data: settings, error: settingsError } = await supabase
        .from('household_settings')
        .select('onboarding_completed')
        .eq('family_id', resolvedFamilyId)
        .maybeSingle();

      if (settingsError) {
        console.error('Error fetching household onboarding status:', settingsError);
        setNeedsOnboarding(true);
        return;
      }

      setNeedsOnboarding(!(settings?.onboarding_completed ?? false));
    } finally {
      setLoading(false);
    }
  }, [user, fetchFamilyId]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const completeOnboarding = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const resolvedFamilyId = familyIdRef.current ?? (await fetchFamilyId());
    if (!resolvedFamilyId) return false;

    familyIdRef.current = resolvedFamilyId;

    const { error } = await supabase
      .from('household_settings')
      .upsert(
        {
          family_id: resolvedFamilyId,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        } as any,
        { onConflict: 'family_id' }
      );

    if (error) {
      console.error('Error completing onboarding:', error);
      return false;
    }

    setNeedsOnboarding(false);
    return true;
  }, [user, fetchFamilyId]);

  return {
    needsOnboarding,
    loading,
    completeOnboarding,
    refreshStatus: checkOnboardingStatus,
  };
}
