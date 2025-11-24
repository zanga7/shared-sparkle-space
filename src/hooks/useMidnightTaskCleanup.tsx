import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CLEANUP_STORAGE_KEY = 'last_task_cleanup';

/**
 * Hook that automatically hides completed tasks at midnight in the user's timezone
 */
export const useMidnightTaskCleanup = () => {
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user) return;

    const checkAndCleanup = async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const lastCleanup = localStorage.getItem(CLEANUP_STORAGE_KEY);

      // If we've already cleaned up today, skip
      if (lastCleanup === today) {
        return;
      }

      try {
        // Get the user's profile to access family_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.family_id) return;

        // Call the RPC function to hide completed tasks
        const { data, error } = await supabase.rpc('hide_completed_tasks', {
          p_family_id: profile.family_id
        });

        if (error) {
          console.error('Error hiding completed tasks:', error);
          return;
        }

        // Store that we've done cleanup today
        localStorage.setItem(CLEANUP_STORAGE_KEY, today);
        
        const result = data as { success: boolean; hidden_count: number } | null;
        if (result && result.hidden_count > 0) {
          console.log(`Hidden ${result.hidden_count} completed tasks`);
          
          // Trigger a refresh by dispatching a custom event
          window.dispatchEvent(new CustomEvent('tasks-cleaned-up'));
        }
      } catch (error) {
        console.error('Error during task cleanup:', error);
      }
    };

    const scheduleNextCleanup = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Set to midnight
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      // Schedule cleanup at midnight
      timeoutRef.current = setTimeout(() => {
        checkAndCleanup();
        // After running at midnight, set up daily interval
        intervalRef.current = setInterval(checkAndCleanup, 24 * 60 * 60 * 1000);
      }, msUntilMidnight);
    };

    // Check if we need to clean up on mount (in case app was closed at midnight)
    checkAndCleanup();
    
    // Schedule next cleanup at midnight
    scheduleNextCleanup();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user]);
};
