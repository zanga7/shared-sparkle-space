import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CLEANUP_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

/**
 * Hook that automatically hides completed tasks after a configured time period
 */
export const useMidnightTaskCleanup = () => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const [hideHours, setHideHours] = useState<number>(12);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.family_id) return;

        const { data: settings } = await supabase
          .from('household_settings')
          .select('completed_tasks_hide_hours')
          .eq('family_id', profile.family_id)
          .single();

        if (settings?.completed_tasks_hide_hours) {
          setHideHours(settings.completed_tasks_hide_hours);
        }
      } catch (error) {
        console.error('Error loading cleanup settings:', error);
      }
    };

    const checkAndCleanup = async () => {
      try {
        // Get the user's profile to access family_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.family_id) return;

        // Calculate the cutoff time based on hide hours setting
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - hideHours);

        // First, get task IDs that have completions older than cutoff
        const { data: completedTasks } = await supabase
          .from('task_completions')
          .select('task_id')
          .lt('completed_at', cutoffTime.toISOString());

        if (!completedTasks || completedTasks.length === 0) return;

        const taskIds = completedTasks.map(t => t.task_id);

        // Hide tasks that were completed before the cutoff time
        const { error } = await supabase
          .from('tasks')
          .update({ hidden_at: new Date().toISOString() })
          .eq('family_id', profile.family_id)
          .is('hidden_at', null)
          .in('id', taskIds);

        if (error) {
          console.error('Error hiding completed tasks:', error);
          return;
        }

        // Trigger a refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('tasks-cleaned-up'));
      } catch (error) {
        console.error('Error during task cleanup:', error);
      }
    };

    // Load settings first
    loadSettings();

    // Run cleanup on mount
    checkAndCleanup();
    
    // Run cleanup every hour
    intervalRef.current = setInterval(checkAndCleanup, CLEANUP_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, hideHours]);
};
