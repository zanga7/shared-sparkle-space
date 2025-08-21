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
  start_date: string | null;
  repetition_count: number | null;
  remaining_repetitions: number | null;
  monthly_type: 'date' | 'weekday' | null;
  monthly_weekday_ordinal: number | null;
  skip_next_occurrence: boolean;
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
      setTaskSeries((data || []).map(item => ({
        ...item,
        monthly_type: item.monthly_type as 'date' | 'weekday' | null
      })));
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
    start_date?: string;
    repetition_count?: number | null;
    remaining_repetitions?: number | null;
    monthly_type?: 'date' | 'weekday' | null;
    monthly_weekday_ordinal?: number | null;
  }) => {
    try {
      setLoading(true);

      // For now, create the task series normally and handle first task generation via trigger
      const { data, error } = await supabase
        .from('task_series')
        .insert({
          family_id: seriesData.family_id,
          title: seriesData.title,
          description: seriesData.description,
          points: seriesData.points,
          assigned_to: seriesData.assigned_to,
          created_by: seriesData.created_by,
          recurring_frequency: seriesData.recurring_frequency,
          recurring_interval: seriesData.recurring_interval,
          recurring_days_of_week: seriesData.recurring_days_of_week,
          recurring_end_date: seriesData.recurring_end_date,
          start_date: seriesData.start_date,
          repetition_count: seriesData.repetition_count,
          remaining_repetitions: seriesData.remaining_repetitions,
          monthly_type: seriesData.monthly_type,
          monthly_weekday_ordinal: seriesData.monthly_weekday_ordinal,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Let the database trigger handle first task creation

      toast({
        title: 'Success',
        description: 'Recurring task series created successfully!',
      });
      await fetchTaskSeries(); // Refresh the list
    } catch (error) {
      console.error('Error creating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create recurring task series',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
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