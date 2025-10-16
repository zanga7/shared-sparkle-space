import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecurrenceRule } from '@/types/recurrence';
import { addDays, addWeeks, addMonths, addYears, format, isBefore, isAfter } from 'date-fns';
import { toRRULE } from '@/utils/rruleConverter';
import { generateInstances as generateRRuleInstances } from '@/utils/rruleInstanceGenerator';

export interface TaskSeries {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description?: string;
  points: number;
  task_group: string;
  completion_rule: string;
  recurrence_rule: RecurrenceRule;
  series_start: string;
  series_end?: string;
  original_series_id?: string;
  assigned_profiles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventSeries {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description?: string;
  location?: string;
  recurrence_rule: RecurrenceRule;
  series_start: string;
  series_end?: string;
  original_series_id?: string;
  duration_minutes: number;
  is_all_day: boolean;
  attendee_profiles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceException {
  id: string;
  series_id: string;
  series_type: 'task' | 'event';
  exception_date: string; // ISO date string
  exception_type: 'skip' | 'override';
  override_data?: any;
  created_at: string;
  created_by: string;
}

export interface SeriesInstance {
  date: Date;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
  overrideData?: any;
  originalData: any; // The base series data
}

export const useRecurringSeries = (familyId?: string) => {
  const { toast } = useToast();
  const [taskSeries, setTaskSeries] = useState<TaskSeries[]>([]);
  const [eventSeries, setEventSeries] = useState<EventSeries[]>([]);
  const [exceptions, setExceptions] = useState<RecurrenceException[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all series and exceptions
  const fetchSeries = async () => {
    if (!familyId) return;
    
    setLoading(true);
    try {
      // Fetch task series
      const { data: taskSeriesData, error: taskError } = await supabase
        .from('task_series')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true);

      if (taskError) throw taskError;

      // Fetch event series
      const { data: eventSeriesData, error: eventError } = await supabase
        .from('event_series')
        .select('*')
        .eq('family_id', familyId)
        .eq('is_active', true);

      if (eventError) throw eventError;

      // Fetch exceptions
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from('recurrence_exceptions')
        .select('*');

      if (exceptionsError) throw exceptionsError;

      setTaskSeries((taskSeriesData || []).map(item => ({
        ...item,
        recurrence_rule: item.recurrence_rule as unknown as RecurrenceRule
      })));
      setEventSeries((eventSeriesData || []).map(item => ({
        ...item,
        recurrence_rule: item.recurrence_rule as unknown as RecurrenceRule
      })));
      setExceptions((exceptionsData || []).map(item => ({
        ...item,
        series_type: item.series_type as 'task' | 'event',
        exception_type: item.exception_type as 'skip' | 'override'
      })));
    } catch (error) {
      console.error('Error fetching series:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recurring series',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, [familyId]);

  // Generate instances for a series within a date range using RRULE
  const generateSeriesInstances = (
    series: TaskSeries | EventSeries,
    startDate: Date,
    endDate: Date
  ): SeriesInstance[] => {
    const rule = series.recurrence_rule;
    const seriesStart = new Date(series.series_start);

    // Get exceptions for this series
    const seriesExceptions = exceptions.filter(e => 
      e.series_id === series.id && 
      ('series_type' in series ? e.series_type === 'task' : e.series_type === 'event')
    );

    try {
      // Use RRULE-based instance generation for accuracy and RFC 5545 compliance
      const rruleInstances = generateRRuleInstances({
        startDate,
        endDate,
        seriesStart, // Pass the series' true start for correct DTSTART
        recurrenceRule: rule,
        exceptions: seriesExceptions,
        maxInstances: 1000
      });

      // Map to SeriesInstance format and filter out any instances before series start
      return rruleInstances
        .filter(instance => instance.date >= seriesStart)
        .map(instance => ({
          date: instance.date,
          isException: instance.isException,
          exceptionType: instance.exceptionType,
          overrideData: instance.overrideData,
          originalData: series
        }));
    } catch (error) {
      console.error('Error generating series instances with RRULE, falling back to legacy method:', error);
      
      // Fallback to legacy generation if RRULE fails
      return legacyGenerateInstances(series, startDate, endDate, seriesExceptions);
    }
  };

  // Legacy instance generation (kept as fallback)
  const legacyGenerateInstances = (
    series: TaskSeries | EventSeries,
    startDate: Date,
    endDate: Date,
    seriesExceptions: RecurrenceException[]
  ): SeriesInstance[] => {
    const instances: SeriesInstance[] = [];
    const rule = series.recurrence_rule;
    const seriesStart = new Date(series.series_start);
    const seriesEnd = series.series_end ? new Date(series.series_end) : null;
    
    let currentDate = new Date(seriesStart);
    let count = 0;
    const maxInstances = rule.endCount || 100;

    while (
      (isBefore(currentDate, endDate) || currentDate.getTime() === endDate.getTime()) &&
      count < maxInstances &&
      (!seriesEnd || isBefore(currentDate, seriesEnd))
    ) {
      if (!isBefore(currentDate, startDate)) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const exception = seriesExceptions.find(e => e.exception_date === dateStr);

        if (!(exception && exception.exception_type === 'skip')) {
          instances.push({
            date: new Date(currentDate),
            isException: !!exception,
            exceptionType: exception?.exception_type,
            overrideData: exception?.override_data,
            originalData: series
          });
        }
      }

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

  // Create a new task series with RRULE generation
  const createTaskSeries = async (seriesData: Omit<TaskSeries, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Generate RRULE string for calendar integration
      const rruleString = toRRULE(seriesData.recurrence_rule, new Date(seriesData.series_start));
      
      const { data, error } = await supabase
        .from('task_series')
        .insert({
          ...seriesData,
          recurrence_rule: seriesData.recurrence_rule as any,
          rrule: rruleString // Store RFC 5545 compliant RRULE
        })
        .select()
        .single();

      if (error) throw error;

      await fetchSeries(); // Refresh data
      return data;
    } catch (error) {
      console.error('Error creating task series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Create a new event series with RRULE generation
  const createEventSeries = async (seriesData: Omit<EventSeries, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Generate RRULE string for calendar integration
      const rruleString = toRRULE(seriesData.recurrence_rule, new Date(seriesData.series_start));
      
      const { data, error } = await supabase
        .from('event_series')
        .insert({
          ...seriesData,
          recurrence_rule: seriesData.recurrence_rule as any,
          rrule: rruleString // Store RFC 5545 compliant RRULE
        })
        .select()
        .single();

      if (error) throw error;

      await fetchSeries(); // Refresh data
      return data;
    } catch (error) {
      console.error('Error creating event series:', error);
      toast({
        title: 'Error',
        description: 'Failed to create event series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Create an exception (skip or override)
  const createException = async (exceptionData: Omit<RecurrenceException, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('recurrence_exceptions')
        .insert(exceptionData)
        .select()
        .single();

      if (error) throw error;

      await fetchSeries(); // Refresh data
      // Trigger global refresh for calendar views
      if (typeof window !== 'undefined') {
        const w: any = window as any;
        if (typeof w.refreshEvents === 'function') {
          w.refreshEvents();
        } else if (typeof w.refreshCalendar === 'function') {
          w.refreshCalendar();
        }
      }
      return data;
    } catch (error) {
      console.error('Error creating exception:', error);
      toast({
        title: 'Error',
        description: 'Failed to create exception',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Update a series (all occurrences) with RRULE regeneration
  const updateSeries = async (
    seriesId: string,
    seriesType: 'task' | 'event',
    updates: Partial<TaskSeries | EventSeries>
  ) => {
    try {
      console.log('Updating series:', seriesId, 'with updates:', updates);
      
      const table = seriesType === 'task' ? 'task_series' : 'event_series';
      
      // If recurrence_rule is being updated, regenerate RRULE
      let updateData: any = updates;
      if (updates.recurrence_rule) {
        const series = getSeriesById(seriesId, seriesType);
        const seriesStart = updates.series_start || series?.series_start || new Date().toISOString();
        const rruleString = toRRULE(updates.recurrence_rule, new Date(seriesStart));
        
        updateData = {
          ...updates,
          recurrence_rule: updates.recurrence_rule as any,
          rrule: rruleString // Update RRULE for calendar sync
        };
      }
      
      const { error } = await supabase
        .from(table)
        .update(updateData as any)
        .eq('id', seriesId);

      if (error) throw error;

      console.log('Series updated successfully, refreshing data...');
      await fetchSeries(); // Refresh data
      
      // Trigger global calendar refresh after series update
      if (typeof window !== 'undefined') {
        const w: any = window as any;
        if (typeof w.refreshEvents === 'function') {
          console.log('Triggering refreshEvents after series update');
          w.refreshEvents();
        } else if (typeof w.refreshCalendar === 'function') {
          console.log('Triggering refreshCalendar after series update');
          w.refreshCalendar();
        }
      }
      
      return true; // Indicate success
    } catch (error) {
      console.error('Error updating series:', error);
      toast({
        title: 'Error',
        description: 'Failed to update series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Split a series (this and following)
  const splitSeries = async (
    originalSeriesId: string,
    seriesType: 'task' | 'event',
    splitDate: Date,
    newSeriesData: Partial<TaskSeries | EventSeries>
  ) => {
    try {
      console.log('Splitting series at', splitDate);
      
      // 1. Get the original series
      const originalSeries = getSeriesById(originalSeriesId, seriesType);
      if (!originalSeries) {
        throw new Error('Original series not found');
      }

      // 2. Update the original series to end BEFORE the split date
      // Create a new recurrence_rule with endType: 'on_date' and endDate = day before split
      const dayBeforeSplit = new Date(splitDate);
      dayBeforeSplit.setDate(dayBeforeSplit.getDate() - 1);
      const endDateStr = format(dayBeforeSplit, 'yyyy-MM-dd');
      
      const updatedOriginalRule: RecurrenceRule = {
        ...originalSeries.recurrence_rule,
        endType: 'on_date',
        endDate: endDateStr
      };

      await updateSeries(originalSeriesId, seriesType, {
        recurrence_rule: updatedOriginalRule
      });

      console.log('Original series updated to end on:', endDateStr);

      // 3. Create new series starting from split date
      // Ensure we have a recurrence_rule for the new series
      const effectiveRecurrenceRule = newSeriesData.recurrence_rule || originalSeries.recurrence_rule;
      
      const createData = {
        ...newSeriesData,
        recurrence_rule: effectiveRecurrenceRule,
        series_start: splitDate.toISOString(),
        original_series_id: originalSeriesId
      };

      console.log('Creating new series starting from:', splitDate.toISOString());

      let res;
      if (seriesType === 'task') {
        res = await createTaskSeries(createData as Omit<TaskSeries, 'id' | 'created_at' | 'updated_at'>);
      } else {
        res = await createEventSeries(createData as Omit<EventSeries, 'id' | 'created_at' | 'updated_at'>);
      }

      // Trigger global refresh for calendar views
      if (typeof window !== 'undefined') {
        const w: any = window as any;
        if (typeof w.refreshEvents === 'function') {
          w.refreshEvents();
        } else if (typeof w.refreshCalendar === 'function') {
          w.refreshCalendar();
        }
      }

      return res;
    } catch (error) {
      console.error('Error splitting series:', error);
      toast({
        title: 'Error',
        description: 'Failed to split series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Delete an entire series
  const deleteSeries = async (seriesId: string, seriesType: 'task' | 'event') => {
    try {
      const table = seriesType === 'task' ? 'task_series' : 'event_series';
      
      // First delete all exceptions for this series
      await supabase
        .from('recurrence_exceptions')
        .delete()
        .eq('series_id', seriesId)
        .eq('series_type', seriesType);

      // Then delete the series itself
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', seriesId);

      if (error) throw error;

      await fetchSeries(); // Refresh data
      
      toast({
        title: 'Success',
        description: `${seriesType === 'task' ? 'Task' : 'Event'} series deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting series:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Get series by ID
  const getSeriesById = (seriesId: string, seriesType: 'task' | 'event') => {
    if (seriesType === 'task') {
      return taskSeries.find(s => s.id === seriesId);
    } else {
      return eventSeries.find(s => s.id === seriesId);
    }
  };

  return {
    taskSeries,
    eventSeries,
    exceptions,
    loading,
    fetchSeries,
    generateSeriesInstances,
    createTaskSeries,
    createEventSeries,
    createException,
    updateSeries,
    splitSeries,
    deleteSeries,
    getSeriesById
  };
};