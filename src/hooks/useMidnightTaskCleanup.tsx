import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CLEANUP_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

/**
 * Hook that automatically hides completed tasks after a configured time period
 */
export const useMidnightTaskCleanup = () => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const hasRunInitialCleanup = useRef(false);

  const checkAndCleanup = useCallback(async () => {
    if (!user) return;

    try {
      // Get the user's profile to access family_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.family_id) return;

      // Get the hide hours setting - fetch fresh each time
      const { data: settings } = await supabase
        .from('household_settings')
        .select('completed_tasks_hide_hours')
        .eq('family_id', profile.family_id)
        .single();

      const hideHours = settings?.completed_tasks_hide_hours ?? 12;

      // Calculate the cutoff time based on hide hours setting
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hideHours);

      console.log(`🧹 Task cleanup: hiding tasks completed before ${cutoffTime.toISOString()} (${hideHours} hours ago)`);

      // First, get task IDs that have completions older than cutoff
      const { data: completedTasks } = await supabase
        .from('task_completions')
        .select('task_id')
        .lt('completed_at', cutoffTime.toISOString());

      if (!completedTasks || completedTasks.length === 0) {
        console.log('🧹 No tasks to hide');
        return;
      }

      const taskIds = completedTasks.map(t => t.task_id);

      // Hide tasks that were completed before the cutoff time
      // Don't hide recurring source tasks
      const { data: hiddenData, error } = await supabase
        .from('tasks')
        .update({ hidden_at: new Date().toISOString() })
        .eq('family_id', profile.family_id)
        .is('hidden_at', null)
        .in('id', taskIds)
        .or('task_source.is.null,task_source.neq.recurring')
        .select('id');

      if (error) {
        console.error('Error hiding completed tasks:', error);
        return;
      }

      const hiddenCount = hiddenData?.length ?? 0;
      if (hiddenCount > 0) {
        console.log(`🧹 Hidden ${hiddenCount} completed tasks`);
        // Trigger a refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('tasks-cleaned-up'));
      }
    } catch (error) {
      console.error('Error during task cleanup:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Run cleanup on mount (only once)
    if (!hasRunInitialCleanup.current) {
      hasRunInitialCleanup.current = true;
      checkAndCleanup();
    }
    
    // Run cleanup every hour
    intervalRef.current = setInterval(checkAndCleanup, CLEANUP_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, checkAndCleanup]);
};
