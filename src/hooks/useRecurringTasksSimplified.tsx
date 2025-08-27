import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskSeries, Task } from '@/types/task';
import { useTaskGeneration } from './useTaskGeneration';

/**
 * Simplified recurring tasks hook that follows a single pattern:
 * 1. Store recurring rules in task_series
 * 2. Generate actual task records on-demand (not virtual instances)
 * 3. One source of truth for all tasks
 */
export const useRecurringTasksSimplified = (familyId?: string, dateRange?: { start: Date; end: Date }) => {
  const { toast } = useToast();
  const { generateForDateRange, isGenerating } = useTaskGeneration();
  
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const generatedRef = useRef(false);

  // Calculate date range (default to current month)
  const getDateRange = useCallback(() => {
    if (dateRange) return dateRange;
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    };
  }, [dateRange]);

  // Fetch recurring task series
  const fetchTaskSeries = useCallback(async () => {
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
        description: 'Failed to load recurring task series',
        variant: 'destructive',
      });
    }
  }, [familyId, toast]);

  // Fetch actual task records (both recurring and non-recurring)
  const fetchTasks = useCallback(async () => {
    if (!familyId) return;

    const range = getDateRange();
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_completions(*)
        `)
        .eq('family_id', familyId)
        .gte('due_date', range.start.toISOString())
        .lte('due_date', range.end.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks((data || []).map(task => ({
        ...task,
        completion_rule: task.completion_rule as 'any_one' | 'everyone',
        assignees: [],
        task_completions: task.task_completions || []
      })));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive',
      });
    }
  }, [familyId, getDateRange, toast]);

  // Generate missing task instances using the unified edge function
  const generateMissingTasks = useCallback(async () => {
    if (!familyId || generatedRef.current || isGenerating) return;

    generatedRef.current = true;
    const range = getDateRange();
    
    try {
      console.log('Triggering unified task generation...');
      const result = await generateForDateRange(familyId, range.start, range.end);
      
      if (result && result.inserted_count > 0) {
        // Refresh tasks after generation
        await fetchTasks();
      }
    } catch (error) {
      console.error('Error generating missing tasks:', error);
    } finally {
      generatedRef.current = false;
    }
  }, [familyId, getDateRange, generateForDateRange, fetchTasks, isGenerating]);

  // Create a new recurring task series
  const createTaskSeries = useCallback(async (seriesData: Partial<TaskSeries> & { 
    title: string; 
    created_by: string; 
    recurring_frequency: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('task_series')
        .insert([{
          ...seriesData,
          family_id: familyId!,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      await fetchTaskSeries();
      toast({
        title: 'Success',
        description: 'Recurring task series created successfully',
      });

      return data;
    } catch (error) {
      console.error('Error creating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create recurring task series',
        variant: 'destructive',
      });
      throw error;
    }
  }, [familyId, fetchTaskSeries, toast]);

  // Update task series
  const updateTaskSeries = useCallback(async (id: string, updates: Partial<TaskSeries>) => {
    try {
      const { error } = await supabase
        .from('task_series')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchTaskSeries();
      toast({
        title: 'Success',
        description: 'Recurring task series updated successfully',
      });
    } catch (error) {
      console.error('Error updating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recurring task series',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchTaskSeries, toast]);

  // Complete a task
  const completeTask = useCallback(async (taskId: string, completedBy: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');

      const { error } = await supabase
        .from('task_completions')
        .insert({
          task_id: taskId,
          completed_by: completedBy,
          points_earned: task.points
        });

      if (error) throw error;

      await fetchTasks();
      toast({
        title: 'Success',
        description: 'Task completed successfully',
      });
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  }, [tasks, fetchTasks, toast]);

  const refresh = useCallback(async () => {
    generatedRef.current = false;
    await fetchTaskSeries();
    await fetchTasks();
  }, [fetchTaskSeries, fetchTasks]);

  // Initialize data
  useEffect(() => {
    if (!familyId) return;

    const loadData = async () => {
      setLoading(true);
      generatedRef.current = false;
      
      try {
        await fetchTaskSeries();
        await fetchTasks();
        
        // Generate tasks after a short delay to ensure data is loaded
        setTimeout(() => {
          generateMissingTasks();
        }, 500);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [familyId, fetchTaskSeries, fetchTasks, generateMissingTasks]);

  return {
    taskSeries,
    tasks,
    loading: loading || isGenerating,
    createTaskSeries,
    updateTaskSeries,
    completeTask,
    refresh
  };
};