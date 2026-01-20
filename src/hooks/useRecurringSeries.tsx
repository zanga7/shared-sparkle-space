import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecurrenceRule } from '@/types/recurrence';
import { addDays, addWeeks, addMonths, addYears, format, isBefore, isAfter } from 'date-fns';
import { toRRULE } from '@/utils/rruleConverter';
import { generateInstances as generateRRuleInstances } from '@/utils/rruleInstanceGenerator';

function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

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
      // Parallelize all database queries for faster loading
      const [
        { data: taskSeriesData, error: taskError },
        { data: eventSeriesData, error: eventError },
        { data: exceptionsData, error: exceptionsError }
      ] = await Promise.all([
        supabase
          .from('task_series')
          .select('*')
          .eq('family_id', familyId)
          .eq('is_active', true),
        supabase
          .from('event_series')
          .select('*')
          .eq('family_id', familyId)
          .eq('is_active', true),
        supabase
          .from('recurrence_exceptions')
          .select('*')
      ]);

      if (taskError) throw taskError;
      if (eventError) throw eventError;
      if (exceptionsError) throw exceptionsError;

      // Update state normally (React batches these automatically)
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
    const rawSeriesStart = series.series_start;
    const isEventSeries = (series as any).is_all_day !== undefined;
    const seriesStart = isEventSeries && (series as any).is_all_day && /^\d{4}-\d{2}-\d{2}$/.test(rawSeriesStart)
      ? parseLocalDateString(rawSeriesStart)
      : new Date(rawSeriesStart);

    // Get exceptions for this series
    // Get exceptions for this series (determine type by shape)
    const isTaskSeries = (series as any).points !== undefined;
    const seriesExceptions = exceptions.filter(
      (e) => e.series_id === series.id && e.series_type === (isTaskSeries ? 'task' : 'event')
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

      // Compare only the calendar date portion to avoid filtering out first occurrence
      // when series starts later in the day (e.g., 9:00 AM vs midnight instance)
      const seriesStartDateOnly = new Date(
        seriesStart.getFullYear(),
        seriesStart.getMonth(),
        seriesStart.getDate()
      );

      // Map to SeriesInstance format and filter out any instances before series start date
      return rruleInstances
        .filter(instance => instance.date >= seriesStartDateOnly)
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

  // Create an exception (skip or override) - now with upsert to handle existing overrides
  const createException = async (exceptionData: Omit<RecurrenceException, 'id' | 'created_at'>) => {
    try {
      console.debug('[createException] Creating/updating exception:', {
        series_id: exceptionData.series_id,
        exception_date: exceptionData.exception_date,
        exception_type: exceptionData.exception_type
      });

      // Use upsert to handle existing exceptions for the same date
      const { data, error } = await supabase
        .from('recurrence_exceptions')
        .upsert(exceptionData, {
          onConflict: 'series_id,series_type,exception_date'
        })
        .select()
        .single();

      if (error) {
        console.error('[createException] Error creating exception:', error);
        throw error;
      }

      console.debug('[createException] Upserted exception:', {
        series_id: exceptionData.series_id,
        exception_date: exceptionData.exception_date,
        exception_type: exceptionData.exception_type
      });

      await fetchSeries();
      
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

  // Helper to cascade updates to override exceptions
  const applyUpdatesToOverrideExceptions = async (
    seriesId: string,
    seriesType: 'task' | 'event',
    changedFields: string[],
    updates: Partial<TaskSeries | EventSeries>
  ) => {
    try {
      // Fetch all override exceptions for this series
      const { data: exceptions, error } = await supabase
        .from('recurrence_exceptions')
        .select('*')
        .eq('series_id', seriesId)
        .eq('series_type', seriesType)
        .eq('exception_type', 'override');

      if (error) throw error;
      if (!exceptions || exceptions.length === 0) {
        console.debug('No override exceptions to update for series:', seriesId);
        return 0;
      }

      // Update each exception with only the changed fields
      const updatePromises = exceptions.map(async (exception) => {
        const currentOverride = (exception.override_data || {}) as Record<string, any>;
        const mergedOverride = { ...currentOverride };

        // Only update fields that were actually changed
        changedFields.forEach(field => {
          if (field in updates) {
            mergedOverride[field] = (updates as any)[field];
          }
        });

        return supabase
          .from('recurrence_exceptions')
          .update({ override_data: mergedOverride })
          .eq('id', exception.id);
      });

      await Promise.all(updatePromises);
      console.debug(`Updated ${exceptions.length} override exceptions with fields:`, changedFields);
      return exceptions.length;
    } catch (error) {
      console.error('Error cascading updates to overrides:', error);
      throw error;
    }
  };

  // Update a series (all occurrences) with RRULE regeneration
  const updateSeries = async (
    seriesId: string,
    seriesType: 'task' | 'event',
    updates: Partial<TaskSeries | EventSeries>,
    cascadeToOverrides: boolean = false,
    changedFields: string[] = []
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
      
      const { data: updatedRow, error } = await supabase
        .from(table)
        .update(updateData as any)
        .eq('id', seriesId)
        .select()
        .single();

      if (error) throw error;

      console.debug('Series updated successfully:', { seriesId, updatedRow, updates });

      // Cascade changes to override exceptions if requested
      if (cascadeToOverrides && changedFields.length > 0) {
        const overrideCount = await applyUpdatesToOverrideExceptions(
          seriesId,
          seriesType,
          changedFields,
          updates
        );
        console.debug(`Cascaded updates to ${overrideCount} overridden dates`);
      }

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

  // Split a series (this and following) - ENHANCED to transfer future overrides
  const splitSeries = async (
    originalSeriesId: string,
    seriesType: 'task' | 'event',
    splitDate: Date,
    newSeriesData: Partial<TaskSeries | EventSeries>
  ) => {
    try {
      console.log('[splitSeries] Splitting series at', splitDate);
      
      // 1. Get the original series
      const originalSeries = getSeriesById(originalSeriesId, seriesType);
      if (!originalSeries) {
        throw new Error('Original series not found');
      }

      // 2. Update the original series to end BEFORE the split date
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

      console.log('[splitSeries] Original series updated to end on:', endDateStr);

      // 3. Create new series starting from split date
      const effectiveRecurrenceRule = newSeriesData.recurrence_rule || originalSeries.recurrence_rule;
      
      const createData = {
        ...newSeriesData,
        recurrence_rule: effectiveRecurrenceRule,
        series_start: splitDate.toISOString(),
        original_series_id: originalSeriesId
      };

      console.log('[splitSeries] Creating new series starting from:', splitDate.toISOString());

      let newSeries;
      if (seriesType === 'task') {
        newSeries = await createTaskSeries(createData as Omit<TaskSeries, 'id' | 'created_at' | 'updated_at'>);
      } else {
        newSeries = await createEventSeries(createData as Omit<EventSeries, 'id' | 'created_at' | 'updated_at'>);
      }

      if (!newSeries) {
        throw new Error('Failed to create new series');
      }

      // 4. **NEW**: Transfer all future override exceptions to new series
      const splitDateStr = format(splitDate, 'yyyy-MM-dd');
      
      const { data: futureOverrides, error: fetchError } = await supabase
        .from('recurrence_exceptions')
        .select('*')
        .eq('series_id', originalSeriesId)
        .eq('series_type', seriesType)
        .eq('exception_type', 'override')
        .gte('exception_date', splitDateStr);

      if (fetchError) {
        console.error('[splitSeries] Error fetching future overrides:', fetchError);
      } else if (futureOverrides && futureOverrides.length > 0) {
        console.log(`[splitSeries] Transferring ${futureOverrides.length} future overrides to new series`);
        
        // Update each override to point to new series and merge with new series data
        const updatedOverrides = futureOverrides.map(override => {
          // Merge new series base data with existing override data
          const existingOverride = override.override_data as Record<string, any> || {};
          const mergedOverrideData: Record<string, any> = {
            ...existingOverride, // Start with existing override
          };
          
          // Apply new series base data (only if defined)
          Object.keys(newSeriesData).forEach(key => {
            const value = (newSeriesData as any)[key];
            if (value !== undefined) {
              mergedOverrideData[key] = value;
            }
          });

          return {
            id: override.id,
            series_id: newSeries.id, // Point to new series
            series_type: override.series_type,
            exception_date: override.exception_date,
            exception_type: override.exception_type,
            override_data: mergedOverrideData,
            created_by: override.created_by,
            recurrence_id: override.recurrence_id,
          };
        });

        // Batch update all overrides
        const { error: updateError } = await supabase
          .from('recurrence_exceptions')
          .upsert(updatedOverrides, { onConflict: 'id' });

        if (updateError) {
          console.error('[splitSeries] Error transferring overrides:', updateError);
        } else {
          console.log(`[splitSeries] Successfully transferred ${updatedOverrides.length} overrides`);
        }
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

      toast({
        title: 'Success',
        description: 'Series split successfully',
      });

      return newSeries;
    } catch (error) {
      console.error('[splitSeries] Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to split series',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Skip a single occurrence (creates EXDATE-style exception)
  const skipOccurrence = async (
    seriesId: string,
    seriesType: 'task' | 'event',
    occurrenceDate: Date,
    createdBy: string
  ) => {
    try {
      const dateStr = format(occurrenceDate, 'yyyy-MM-dd');
      
      // Create skip exception in recurrence_exceptions table
      await createException({
        series_id: seriesId,
        series_type: seriesType,
        exception_date: dateStr,
        exception_type: 'skip',
        created_by: createdBy
      });

      // Also add to exdates array for RRULE export
      const tableName = seriesType === 'task' ? 'task_series' : 'event_series';
      
      const { error } = await supabase.rpc('add_exdate_to_series', {
        p_series_id: seriesId,
        p_table_name: tableName,
        p_exdate: dateStr
      });

      if (error) {
        console.error('[skipOccurrence] Error adding EXDATE:', error);
      }

      toast({
        title: 'Success',
        description: 'Event skipped successfully',
      });

      // Trigger refresh
      if (typeof window !== 'undefined') {
        const w: any = window as any;
        if (w.refreshEvents) w.refreshEvents();
        else if (w.refreshCalendar) w.refreshCalendar();
      }
    } catch (error) {
      console.error('[skipOccurrence] Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to skip occurrence',
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
    getSeriesById,
    skipOccurrence, // NEW: Skip occurrence helper
  };
};