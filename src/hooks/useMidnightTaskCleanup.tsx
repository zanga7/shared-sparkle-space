import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFamilyData } from '@/contexts/FamilyDataContext';

const CLEANUP_CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes

/**
 * Hook that automatically hides completed tasks after a configured time period.
 * Also runs on page visibility change (when user returns to tab).
 */
export const useMidnightTaskCleanup = () => {
  const { familyId } = useFamilyData();
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastRunRef = useRef<number>(0);

  const checkAndCleanup = useCallback(async () => {
    if (!familyId) return;

    // Debounce: don't run more than once per 5 minutes
    const now = Date.now();
    if (now - lastRunRef.current < 5 * 60 * 1000) return;
    lastRunRef.current = now;

    try {
      console.log('🧹 Running task cleanup via DB function...');

      // Call the DB function directly - it handles settings, filtering, and batching
      const { data: result, error } = await supabase.rpc('hide_completed_tasks', {
        p_family_id: familyId,
      });

      if (error) {
        console.error('🧹 Cleanup error:', error);
        return;
      }

      const hiddenCount = (result as any)?.hidden_count ?? 0;
      if (hiddenCount > 0) {
        console.log(`🧹 Hidden ${hiddenCount} completed tasks`);
        window.dispatchEvent(new CustomEvent('tasks-cleaned-up'));
      } else {
        console.log('🧹 No tasks to hide');
      }
    } catch (error) {
      console.error('🧹 Error during task cleanup:', error);
    }
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;

    // Run cleanup immediately on mount
    checkAndCleanup();
    
    // Run cleanup periodically
    intervalRef.current = setInterval(checkAndCleanup, CLEANUP_CHECK_INTERVAL);

    // Also run when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndCleanup();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [familyId, checkAndCleanup]);
};
