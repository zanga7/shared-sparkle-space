import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskSeries, Task } from '@/types/task';

/**
 * Simplified recurring tasks hook that follows a single pattern:
 * 1. Store recurring rules in task_series
 * 2. Generate actual task records on-demand (not virtual instances)
 * 3. One source of truth for all tasks
 */
export const useRecurringTasksSimplified = (familyId?: string, dateRange?: { start: Date; end: Date }) => {
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

  // Generate missing task instances for the current date range
  const generateMissingTasks = useCallback(async () => {
    if (!familyId || taskSeries.length === 0) return;

    const range = getDateRange();
    
    try {
      for (const series of taskSeries) {
        await generateTasksForSeries(series, range.start, range.end);
      }
      
      // Refresh tasks after generation
      await fetchTasks();
    } catch (error) {
      console.error('Error generating missing tasks:', error);
    }
  }, [familyId, taskSeries, getDateRange, fetchTasks]);

  // Generate tasks for a specific series within date range
  const generateTasksForSeries = async (series: TaskSeries, startDate: Date, endDate: Date) => {
    const existingTasks = tasks.filter(t => t.series_id === series.id);
    const existingDates = new Set(
      existingTasks.map(t => t.due_date?.split('T')[0])
    );

    let currentDate = new Date(series.start_date || series.created_at);
    
    // Ensure we don't go too far back
    if (currentDate < startDate) {
      currentDate = new Date(startDate);
    }

    const tasksToCreate = [];
    let iterationCount = 0;
    const maxIterations = 100; // Safety net

    while (currentDate <= endDate && iterationCount < maxIterations) {
      iterationCount++;
      
      // Check if we've reached the end date
      if (series.recurring_end_date && currentDate > new Date(series.recurring_end_date)) {
        break;
      }

      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Only create if it doesn't already exist
      if (!existingDates.has(dateKey)) {
        tasksToCreate.push({
          family_id: familyId,
          title: series.title,
          description: series.description,
          points: series.points,
          assigned_to: series.assigned_to,
          due_date: new Date(currentDate).toISOString(),
          created_by: series.created_by,
          series_id: series.id,
          is_repeating: true,
          task_group: 'recurring',
          completion_rule: 'everyone'
        });
      }

      // Calculate next date
      currentDate = getNextDate(currentDate, series);
    }

    // Batch insert new tasks
    if (tasksToCreate.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .insert(tasksToCreate);
        
      if (error) {
        console.error('Error creating recurring tasks:', error);
        throw error;
      }
    }
  };

  // Calculate next occurrence date
  const getNextDate = (currentDate: Date, series: TaskSeries): Date => {
    const next = new Date(currentDate);
    
    switch (series.recurring_frequency) {
      case 'daily':
        next.setDate(next.getDate() + (series.recurring_interval || 1));
        break;
        
      case 'weekly':
        if (series.recurring_days_of_week && series.recurring_days_of_week.length > 0) {
          // Find next occurrence in specified days
          let daysToAdd = 1;
          const maxDays = 7 * (series.recurring_interval || 1);
          
          while (daysToAdd <= maxDays) {
            const testDate = new Date(currentDate);
            testDate.setDate(testDate.getDate() + daysToAdd);
            
            if (series.recurring_days_of_week.includes(testDate.getDay())) {
              return testDate;
            }
            daysToAdd++;
          }
          
          // Fallback to interval weeks
          next.setDate(next.getDate() + (7 * (series.recurring_interval || 1)));
        } else {
          next.setDate(next.getDate() + (7 * (series.recurring_interval || 1)));
        }
        break;
        
      case 'monthly':
        next.setMonth(next.getMonth() + (series.recurring_interval || 1));
        break;
        
      default:
        // Fallback to daily
        next.setDate(next.getDate() + 1);
    }
    
    return next;
  };

  // Create a new recurring task series
  const createTaskSeries = async (seriesData: Partial<TaskSeries> & { 
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
  };

  // Update task series
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
  };

  // Complete a task
  const completeTask = async (taskId: string, completedBy: string) => {
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
  };

  // Initialize data
  useEffect(() => {
    if (!familyId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        await fetchTaskSeries();
        await fetchTasks();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [familyId, fetchTaskSeries, fetchTasks]);

  // Generate missing tasks when series or date range changes
  useEffect(() => {
    if (!loading && taskSeries.length > 0) {
      generateMissingTasks();
    }
  }, [taskSeries, generateMissingTasks, loading]);

  return {
    taskSeries,
    tasks,
    loading,
    createTaskSeries,
    updateTaskSeries,
    completeTask,
    refresh: async () => {
      await fetchTaskSeries();
      await fetchTasks();
    }
  };
};