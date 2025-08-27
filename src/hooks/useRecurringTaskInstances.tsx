import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Task, TaskSeries } from '@/types/task';

// Dynamic recurring task instance generator
export class RecurringTaskGenerator {
  static generateInstances(
    series: TaskSeries, 
    startDate: Date, 
    endDate: Date,
    maxInstances: number = 100
  ): Array<Task & { instanceDate: string; isGenerated: boolean }> {
    const instances: Array<Task & { instanceDate: string; isGenerated: boolean }> = [];
    let currentDate = new Date(series.start_date || series.created_at);
    
    // Ensure we start from the right date
    if (currentDate < startDate) {
      currentDate = this.getNextInstanceDate(series, startDate);
    }
    
    let instanceCount = 0;
    
    while (currentDate <= endDate && instanceCount < maxInstances) {
      // Check if we've hit the end conditions
      if (series.recurring_end_date && currentDate > new Date(series.recurring_end_date)) {
        break;
      }
      
      if (series.repetition_count && instanceCount >= series.repetition_count) {
        break;
      }
      
      // Skip if this occurrence should be skipped
      if (!this.shouldGenerateInstance(series, currentDate)) {
        currentDate = this.getNextInstanceDate(series, currentDate);
        continue;
      }
      
      // Generate the task instance
      const instance: Task & { instanceDate: string; isGenerated: boolean } = {
        id: `${series.id}-${currentDate.toISOString().split('T')[0]}`,
        title: series.title,
        description: series.description,
        points: series.points,
        due_date: currentDate.toISOString(),
        assigned_to: series.assigned_to,
        created_by: series.created_by,
        is_repeating: true,
        recurring_frequency: series.recurring_frequency,
        recurring_interval: series.recurring_interval,
        recurring_days_of_week: series.recurring_days_of_week,
        recurring_end_date: series.recurring_end_date,
        series_id: series.id,
        completion_rule: 'everyone',
        task_group: 'recurring',
        family_id: series.family_id,
        instanceDate: currentDate.toISOString().split('T')[0],
        isGenerated: true,
        // Initialize empty arrays for relationships
        assignees: [],
        task_completions: []
      };
      
      instances.push(instance);
      instanceCount++;
      
      // Move to next instance
      currentDate = this.getNextInstanceDate(series, currentDate);
    }
    
    return instances;
  }
  
  private static shouldGenerateInstance(series: TaskSeries, date: Date): boolean {
    // Check if this specific occurrence should be skipped
    if (series.skip_next_occurrence) {
      // This would need more sophisticated logic to track which specific dates to skip
      return true; // For now, always generate
    }
    
    return true;
  }
  
  private static getNextInstanceDate(series: TaskSeries, fromDate: Date): Date {
    const next = new Date(fromDate);
    
    switch (series.recurring_frequency) {
      case 'daily':
        next.setDate(next.getDate() + series.recurring_interval);
        break;
        
      case 'weekly':
        if (series.recurring_days_of_week && series.recurring_days_of_week.length > 0) {
          // Find next occurrence in the specified days
          let daysToAdd = 1;
          const maxDays = 7 * series.recurring_interval;
          
          while (daysToAdd <= maxDays) {
            const testDate = new Date(fromDate);
            testDate.setDate(testDate.getDate() + daysToAdd);
            
            if (series.recurring_days_of_week.includes(testDate.getDay())) {
              return testDate;
            }
            daysToAdd++;
          }
        } else {
          next.setDate(next.getDate() + (7 * series.recurring_interval));
        }
        break;
        
      case 'monthly':
        if (series.monthly_type === 'weekday' && series.monthly_weekday_ordinal) {
          // Complex monthly weekday calculation
          const originalWeekday = fromDate.getDay();
          next.setMonth(next.getMonth() + series.recurring_interval);
          next.setDate(1); // Start from first of month
          
          // Find the nth occurrence of the weekday
          const ordinal = series.monthly_weekday_ordinal;
          let weekdayCount = 0;
          
          for (let day = 1; day <= 31; day++) {
            next.setDate(day);
            if (next.getMonth() !== fromDate.getMonth() + series.recurring_interval) break;
            
            if (next.getDay() === originalWeekday) {
              weekdayCount++;
              if (weekdayCount === ordinal || (ordinal === -1 && day + 7 > this.getDaysInMonth(next))) {
                break;
              }
            }
          }
        } else {
          // Same date each month
          next.setMonth(next.getMonth() + series.recurring_interval);
        }
        break;
        
      case 'yearly':
        next.setFullYear(next.getFullYear() + (series.recurring_interval || 1));
        break;
        
      default:
        throw new Error(`Unsupported frequency: ${series.recurring_frequency}`);
    }
    
    return next;
  }
  
  private static getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
}

export const useRecurringTaskInstances = (familyId?: string, dateRange?: { start: Date; end: Date }) => {
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Default to current month if no range provided
  const effectiveDateRange = useMemo(() => {
    if (dateRange) return dateRange;
    
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  }, [dateRange]);
  
  // Fetch recurring task series
  const fetchTaskSeries = async () => {
    if (!familyId) return;
    
    try {
      const { data, error } = await supabase
        .from('task_series')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true);
        
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
    }
  };
  
  // Fetch task completions for the date range
  const fetchCompletions = async () => {
    if (!familyId) return;
    
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          task:tasks!inner(series_id, due_date)
        `)
        .gte('completed_at', effectiveDateRange.start.toISOString())
        .lte('completed_at', effectiveDateRange.end.toISOString())
        .not('task.series_id', 'is', null);
        
      if (error) throw error;
      setCompletions(data || []);
    } catch (error) {
      console.error('Error fetching completions:', error);
    }
  };
  
  // Generate task instances for the date range
  const generatedInstances = useMemo(() => {
    const instances: Array<Task & { instanceDate: string; isGenerated: boolean }> = [];
    
    taskSeries.forEach(series => {
      const seriesInstances = RecurringTaskGenerator.generateInstances(
        series,
        effectiveDateRange.start,
        effectiveDateRange.end
      );
      
      // Merge with completion data
      seriesInstances.forEach(instance => {
        const instanceCompletions = completions.filter(comp => 
          comp.task?.series_id === series.id &&
          comp.task?.due_date?.split('T')[0] === instance.instanceDate
        );
        
        instance.task_completions = instanceCompletions;
      });
      
      instances.push(...seriesInstances);
    });
    
    return instances.sort((a, b) => 
      new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
    );
  }, [taskSeries, completions, effectiveDateRange]);
  
  // Complete a recurring task instance
  const completeInstance = async (
    instanceId: string, 
    completedBy: string, 
    instanceDate: string,
    seriesId: string
  ) => {
    try {
      // First, create or find the actual task record for this instance
      const { data: existingTask, error: findError } = await supabase
        .from('tasks')
        .select('id')
        .eq('series_id', seriesId)
        .eq('due_date', instanceDate + 'T00:00:00.000Z')
        .single();
        
      let taskId = existingTask?.id;
      
      if (!existingTask) {
        // Create the actual task record for this instance
        const series = taskSeries.find(s => s.id === seriesId);
        if (!series) throw new Error('Series not found');
        
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            title: series.title,
            description: series.description,
            points: series.points,
            due_date: instanceDate + 'T00:00:00.000Z',
            assigned_to: series.assigned_to,
            created_by: series.created_by,
            is_repeating: true,
            series_id: seriesId,
            family_id: familyId,
            completion_rule: 'everyone',
            task_group: 'recurring'
          })
          .select('id')
          .single();
          
        if (createError) throw createError;
        taskId = newTask.id;
      }
      
      // Create completion record
      const { error: completionError } = await supabase
        .from('task_completions')
        .insert({
          task_id: taskId,
          completed_by: completedBy,
          points_earned: taskSeries.find(s => s.id === seriesId)?.points || 0
        });
        
      if (completionError) throw completionError;
      
      // Refresh completions to update UI
      await fetchCompletions();
      
      toast({
        title: 'Success',
        description: 'Task completed successfully!',
      });
      
    } catch (error) {
      console.error('Error completing instance:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };
  
  useEffect(() => {
    if (familyId) {
      setLoading(true);
      Promise.all([fetchTaskSeries(), fetchCompletions()])
        .finally(() => setLoading(false));
    }
  }, [familyId, effectiveDateRange]);
  
  return {
    instances: generatedInstances,
    taskSeries,
    loading,
    completeInstance,
    refresh: () => Promise.all([fetchTaskSeries(), fetchCompletions()])
  };
};