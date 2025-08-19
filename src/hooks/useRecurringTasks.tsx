import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TaskSeries {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  points: number;
  assigned_to: string | null;
  recurring_frequency: string;
  recurring_interval: number;
  recurring_days_of_week: number[] | null;
  recurring_end_date: string | null;
  is_active: boolean;
  last_generated_date: string | null;
  next_due_date: string | null;
  created_by: string;
  created_at: string;
}

export const useRecurringTasks = (familyId?: string) => {
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTaskSeries = async () => {
    if (!familyId) return;

    try {
      const { data, error } = await supabase
        .from('task_series')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTaskSeries(data || []);
    } catch (error) {
      console.error('Error fetching task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recurring tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTaskSeries = async (seriesData: {
    family_id: string;
    title: string;
    description?: string | null;
    points: number;
    assigned_to?: string | null;
    created_by: string;
    recurring_frequency: string;
    recurring_interval: number;
    recurring_days_of_week?: number[] | null;
    recurring_end_date?: string | null;
  }) => {
    try {
      const { data, error } = await supabase
        .from('task_series')
        .insert([seriesData])
        .select()
        .single();

      if (error) throw error;

      // Generate the first task immediately
      await supabase.functions.invoke('generate-recurring-tasks');
      
      await fetchTaskSeries();
      toast({
        title: 'Success',
        description: 'Recurring task created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create recurring task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTaskSeries = async (id: string, updates: Partial<TaskSeries>) => {
    try {
      const { error } = await supabase
        .from('task_series')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchTaskSeries();
      toast({
        title: 'Success',
        description: 'Recurring task updated successfully',
      });
    } catch (error) {
      console.error('Error updating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recurring task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deactivateTaskSeries = async (id: string) => {
    try {
      const { error } = await supabase
        .from('task_series')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      await fetchTaskSeries();
      toast({
        title: 'Success',
        description: 'Recurring task stopped',
      });
    } catch (error) {
      console.error('Error deactivating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop recurring task',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchTaskSeries();
  }, [familyId]);

  return {
    taskSeries,
    loading,
    createTaskSeries,
    updateTaskSeries,
    deactivateTaskSeries,
    refreshTaskSeries: fetchTaskSeries,
  };
};