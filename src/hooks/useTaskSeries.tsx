import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskRecurrenceOptions } from '@/types/recurrence';
import { Task } from '@/types/task';
import { addDays, addWeeks, addMonths, addYears, format, isBefore, isAfter } from 'date-fns';

export interface TaskSeries {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description?: string;
  points: number;
  task_group: string;
  completion_rule: string;
  recurrence_rule: any;
  series_start: string;
  series_end?: string;
  original_series_id?: string;
  assigned_profiles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskSeriesException {
  id: string;
  series_id: string;
  exception_date: string;
  exception_type: 'skip' | 'override';
  override_data?: any;
  created_at: string;
  created_by: string;
}

export interface VirtualTaskInstance {
  id: string; // Generated from series_id + date
  series_id: string;
  title: string;
  description?: string;
  points: number;
  task_group: string;
  completion_rule: string;
  assigned_profiles: string[];
  due_date: string;
  family_id: string;
  created_by: string;
  isVirtual: true;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
  occurrence_date: string;
  recurrence_options: TaskRecurrenceOptions;
}

interface HolidayDate {
  id: string;
  start_date: string;
  end_date: string;
  name: string;
}

export const useTaskSeries = (familyId?: string) => {
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [exceptions, setExceptions] = useState<TaskSeriesException[]>([]);
  const [holidayDates, setHolidayDates] = useState<HolidayDate[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Check if a date falls within any holiday period
  const isDateInHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidayDates.some(holiday => {
      return dateStr >= holiday.start_date && dateStr <= holiday.end_date;
    });
  };

  // Fetch all task series, exceptions, and holiday dates
  const fetchTaskSeries = async () => {
    if (!familyId) return;
    
    setLoading(true);
    try {
      // Fetch task series
      const { data: seriesData, error: seriesError } = await supabase
        .from('task_series')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true);

      if (seriesError) throw seriesError;

      // Fetch exceptions
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from('recurrence_exceptions')
        .select('*')
        .eq('series_type', 'task');

      if (exceptionsError) throw exceptionsError;

      // Fetch holiday dates for pause during holidays feature
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holiday_dates')
        .select('id, start_date, end_date, name')
        .eq('family_id', familyId);

      if (holidaysError) {
        console.warn('Could not fetch holiday dates:', holidaysError);
      } else {
        setHolidayDates(holidaysData || []);
      }

      setTaskSeries((seriesData || []).map(item => ({
        ...item,
        recurrence_rule: item.recurrence_rule as any
      })));
      setExceptions((exceptionsData || []).map(item => ({
        ...item,
        exception_type: item.exception_type as 'skip' | 'override'
      })));
    } catch (error) {
      console.error('Error fetching task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recurring tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskSeries();
  }, [familyId]);

  // Generate virtual task instances from series within a date range
  const generateVirtualTaskInstances = (startDate: Date, endDate: Date): VirtualTaskInstance[] => {
    const virtualTasks: VirtualTaskInstance[] = [];
    
    taskSeries.forEach(series => {
      const instances = generateSeriesInstances(series, startDate, endDate);
      
      instances.forEach(instance => {
        if (instance.exceptionType === 'skip') return; // Skip this occurrence
        
        const completionRule = instance.overrideData?.completion_rule || series.completion_rule;
        const assignedProfiles = instance.overrideData?.assigned_profiles || series.assigned_profiles;
        
        // For "everyone" completion rule with multiple assignees, create separate instances for each person
        if (completionRule === 'everyone' && assignedProfiles && assignedProfiles.length > 1) {
          assignedProfiles.forEach((profileId, index) => {
            const virtualTask: VirtualTaskInstance = {
              id: `${series.id}-${format(instance.date, 'yyyy-MM-dd')}-${profileId}`,
              series_id: series.id,
              title: instance.overrideData?.title || series.title,
              description: instance.overrideData?.description || series.description,
              points: instance.overrideData?.points || series.points,
              task_group: instance.overrideData?.task_group || series.task_group,
              completion_rule: completionRule,
              assigned_profiles: [profileId], // Single assignee per instance
              due_date: instance.date.toISOString(),
              family_id: series.family_id,
              created_by: series.created_by,
              isVirtual: true,
              isException: instance.isException,
              exceptionType: instance.exceptionType,
              occurrence_date: format(instance.date, 'yyyy-MM-dd'),
              recurrence_options: {
                enabled: true,
                rule: series.recurrence_rule,
                repeatFrom: 'scheduled',
                rotateBetweenMembers: false,
                skipWeekends: false,
                pauseDuringHolidays: false
              }
            };
            
            virtualTasks.push(virtualTask);
          });
        } else {
          // For "any_one" or single assignee, create one shared instance
          const virtualTask: VirtualTaskInstance = {
            id: `${series.id}-${format(instance.date, 'yyyy-MM-dd')}`,
            series_id: series.id,
            title: instance.overrideData?.title || series.title,
            description: instance.overrideData?.description || series.description,
            points: instance.overrideData?.points || series.points,
            task_group: instance.overrideData?.task_group || series.task_group,
            completion_rule: completionRule,
            assigned_profiles: assignedProfiles,
            due_date: instance.date.toISOString(),
            family_id: series.family_id,
            created_by: series.created_by,
            isVirtual: true,
            isException: instance.isException,
            exceptionType: instance.exceptionType,
            occurrence_date: format(instance.date, 'yyyy-MM-dd'),
            recurrence_options: {
              enabled: true,
              rule: series.recurrence_rule,
              repeatFrom: 'scheduled',
              rotateBetweenMembers: false,
              skipWeekends: false,
              pauseDuringHolidays: false
            }
          };
          
          virtualTasks.push(virtualTask);
        }
      });
    });
    
    return virtualTasks.sort((a, b) => 
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
  };

  // Generate instances for a series within a date range
  const generateSeriesInstances = (
    series: TaskSeries,
    startDate: Date,
    endDate: Date
  ) => {
    const instances: any[] = [];
    const rule = series.recurrence_rule;
    const seriesStart = new Date(series.series_start);
    const seriesEnd = series.series_end ? new Date(series.series_end) : null;
    
    // Check if this series should pause during holidays
    const shouldPauseDuringHolidays = rule.pauseDuringHolidays === true;
    
    let currentDate = new Date(seriesStart);
    let count = 0;
    const maxInstances = rule.endCount || 100;

    // Get exceptions for this series
    const seriesExceptions = exceptions.filter(e => e.series_id === series.id);

    while (
      (isBefore(currentDate, endDate) || currentDate.getTime() === endDate.getTime()) &&
      count < maxInstances &&
      (!seriesEnd || isBefore(currentDate, seriesEnd))
    ) {
      if (!isBefore(currentDate, startDate)) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const exception = seriesExceptions.find(e => e.exception_date === dateStr);

        // Skip if explicit skip exception
        if (exception && exception.exception_type === 'skip') {
          // Skip this instance
        } 
        // Skip if pause during holidays is enabled and date falls in a holiday
        else if (shouldPauseDuringHolidays && isDateInHoliday(currentDate)) {
          // Skip this instance - it's during a holiday period
        } 
        else {
          instances.push({
            date: new Date(currentDate),
            isException: !!exception,
            exceptionType: exception?.exception_type,
            overrideData: exception?.override_data,
            originalData: series
          });
        }
      }

      // Move to next occurrence
      switch (rule.frequency) {
        case 'daily':
          currentDate = addDays(currentDate, rule.interval);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, rule.interval);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, rule.interval);
          break;
        case 'yearly':
          currentDate = addYears(currentDate, rule.interval);
          break;
      }

      count++;

      if (rule.endType === 'after_count' && count >= (rule.endCount || 1)) {
        break;
      }
      if (rule.endType === 'on_date' && rule.endDate) {
        if (isAfter(currentDate, new Date(rule.endDate))) {
          break;
        }
      }
    }

    return instances;
  };

  // Create a new task series
  const createTaskSeries = async (seriesData: Omit<TaskSeries, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('task_series')
        .insert({
          ...seriesData,
          recurrence_rule: seriesData.recurrence_rule as any
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTaskSeries();
      
      // Emit event to notify dashboard immediately
      window.dispatchEvent(new Event('series-updated'));
      
      return data;
    } catch (error) {
      console.error('Error creating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create recurring task',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Create an exception (skip or override)
  const createTaskException = async (exceptionData: Omit<TaskSeriesException, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('recurrence_exceptions')
        .insert({
          ...exceptionData,
          series_type: 'task'
        })
        .select()
        .single();

      if (error) throw error;

      await fetchTaskSeries();
      return data;
    } catch (error) {
      console.error('Error creating task exception:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task exception',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Update a task series (all occurrences)
  const updateTaskSeries = async (seriesId: string, updates: Partial<TaskSeries>) => {
    try {
      const updateData = updates.recurrence_rule ? {
        ...updates,
        recurrence_rule: updates.recurrence_rule as any
      } : updates;
      
      const { error } = await supabase
        .from('task_series')
        .update(updateData as any)
        .eq('id', seriesId);

      if (error) throw error;

      await fetchTaskSeries();
    } catch (error) {
      console.error('Error updating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recurring task',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Split a task series (this and following)
  const splitTaskSeries = async (
    originalSeriesId: string,
    splitDate: Date,
    newSeriesData: Partial<TaskSeries>
  ) => {
    try {
      // End the original series at the split date
      await supabase
        .from('task_series')
        .update({ series_end: splitDate.toISOString() })
        .eq('id', originalSeriesId);

      // Create new series starting from split date
      const createData = {
        ...newSeriesData,
        series_start: splitDate.toISOString(),
        original_series_id: originalSeriesId
      };

      return await createTaskSeries(createData as Omit<TaskSeries, 'id' | 'created_at' | 'updated_at'>);
    } catch (error) {
      console.error('Error splitting task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to split task series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  return {
    taskSeries,
    exceptions,
    loading,
    fetchTaskSeries,
    generateVirtualTaskInstances,
    generateSeriesInstances,
    createTaskSeries,
    createTaskException,
    updateTaskSeries,
    splitTaskSeries
  };
};