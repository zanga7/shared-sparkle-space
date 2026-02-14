import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CLEANUP_CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes

/**
 * Hook that automatically hides completed tasks after a configured time period.
 * Also runs on page visibility change (when user returns to tab).
 */
export const useMidnightTaskCleanup = () => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastRunRef = useRef<number>(0);

  const checkAndCleanup = useCallback(async () => {
    if (!user) return;

    // Debounce: don't run more than once per 5 minutes
    const now = Date.now();
    if (now - lastRunRef.current < 5 * 60 * 1000) return;
    lastRunRef.current = now;

    try {
      // Get the user's profile to access family_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.family_id) return;

      // Get the hide hours setting
      const { data: settings } = await supabase
        .from('household_settings')
        .select('completed_tasks_hide_hours')
        .eq('family_id', profile.family_id)
        .single();

      const hideHours = settings?.completed_tasks_hide_hours ?? 12;

      // Calculate the cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hideHours);

      console.log(`🧹 Task cleanup: hiding tasks completed before ${cutoffTime.toISOString()} (${hideHours} hours ago)`);

      // Get task IDs with completions older than cutoff that aren't already hidden
      const { data: completedTasks, error: fetchError } = await supabase
        .from('task_completions')
        .select('task_id')
        .lt('completed_at', cutoffTime.toISOString());

      if (fetchError) {
        console.error('🧹 Error fetching completed tasks:', fetchError);
        return;
      }

      if (!completedTasks || completedTasks.length === 0) {
        console.log('🧹 No tasks to hide');
        return;
      }

      // Deduplicate task IDs
      const taskIds = [...new Set(completedTasks.map(t => t.task_id))];

      // Process in batches of 50 to avoid query limits
      let totalHidden = 0;
      for (let i = 0; i < taskIds.length; i += 50) {
        const batch = taskIds.slice(i, i + 50);
        
        const { data: hiddenData, error } = await supabase
          .from('tasks')
          .update({ hidden_at: new Date().toISOString() })
          .eq('family_id', profile.family_id)
          .is('hidden_at', null)
          .in('id', batch)
          .or('task_source.is.null,task_source.neq.recurring')
          .select('id');

        if (error) {
          console.error('🧹 Error hiding batch:', error);
          continue;
        }

        totalHidden += hiddenData?.length ?? 0;
      }

      if (totalHidden > 0) {
        console.log(`🧹 Hidden ${totalHidden} completed tasks`);
        window.dispatchEvent(new CustomEvent('tasks-cleaned-up'));
      } else {
        console.log('🧹 No unhidden tasks found matching criteria');
      }
    } catch (error) {
      console.error('🧹 Error during task cleanup:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

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
  }, [user, checkAndCleanup]);
};
