import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotatingTask } from '@/types/rotating-tasks';

export const useRotatingTasks = (familyId?: string) => {
  const [rotatingTasks, setRotatingTasks] = useState<RotatingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRotatingTasks = async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase
        .from('rotating_tasks')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRotatingTasks((data || []).map(item => ({
        ...item,
        cadence: item.cadence as 'daily' | 'weekly' | 'monthly'
      })));
    } catch (error) {
      console.error('Error fetching rotating tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rotating tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createRotatingTask = async (taskData: {
    name: string;
    cadence: 'daily' | 'weekly' | 'monthly';
    weekly_days?: number[] | null;
    monthly_day?: number | null;
    member_order: string[];
    points: number;
    description?: string | null;
    family_id: string;
    created_by: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('rotating_tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;

      await fetchRotatingTasks();
      toast({
        title: 'Success',
        description: 'Rotating task created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating rotating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create rotating task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateRotatingTask = async (id: string, updates: Partial<RotatingTask>) => {
    try {
      const { error } = await supabase
        .from('rotating_tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchRotatingTasks();
      toast({
        title: 'Success',
        description: 'Rotating task updated successfully',
      });
    } catch (error) {
      console.error('Error updating rotating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rotating task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteRotatingTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rotating_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchRotatingTasks();
      toast({
        title: 'Success',
        description: 'Rotating task deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting rotating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rotating task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const skipCurrentMember = async (rotatingTaskId: string) => {
    const task = rotatingTasks.find(t => t.id === rotatingTaskId);
    if (!task) return;

    const nextIndex = (task.current_member_index + 1) % task.member_order.length;
    await updateRotatingTask(rotatingTaskId, { current_member_index: nextIndex });
  };

  const togglePauseTask = async (rotatingTaskId: string) => {
    const task = rotatingTasks.find(t => t.id === rotatingTaskId);
    if (!task) return;

    await updateRotatingTask(rotatingTaskId, { is_paused: !task.is_paused });
  };

  useEffect(() => {
    fetchRotatingTasks();
  }, [familyId]);

  return {
    rotatingTasks,
    loading,
    createRotatingTask,
    updateRotatingTask,
    deleteRotatingTask,
    skipCurrentMember,
    togglePauseTask,
    refreshRotatingTasks: fetchRotatingTasks,
  };
};