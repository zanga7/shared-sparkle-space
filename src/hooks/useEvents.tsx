import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';
import { useRecurringSeries } from './useRecurringSeries';
import { VirtualEventInstance } from '@/types/series';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';


export const useEvents = (familyId?: string) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { eventSeries, exceptions, generateSeriesInstances, createEventSeries, createException, updateSeries, splitSeries, deleteSeries } = useRecurringSeries(familyId);

  // Generate virtual event instances from both regular events and series (OPTIMIZED)
  const generateVirtualEvents = (startDate: Date, endDate: Date): CalendarEvent[] => {
    const virtualEvents: CalendarEvent[] = [];
    const normalizedStart = startOfDay(startDate);
    const normalizedEnd = endOfDay(endDate);
    
    // Add regular events with optimized filtering
    events.forEach(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      // Quick validation and overlap check
      if (!isNaN(eventStart.getTime()) && !isNaN(eventEnd.getTime()) && 
          eventEnd >= eventStart && eventEnd >= normalizedStart && eventStart <= normalizedEnd) {
        virtualEvents.push(event);
      }
    });
    
    // Generate virtual instances from series
    eventSeries.forEach(series => {
      const instances = generateSeriesInstances(series, startDate, endDate);
      
      instances.forEach(instance => {
        if (instance.exceptionType === 'skip') return;
        
        // Create virtual event from series instance
          // Apply override data for this instance when present
          const override = instance.overrideData as any | undefined;
          const isAllDay = override?.is_all_day ?? series.is_all_day;

          // Determine start/end using overrides when available
          let startISO: string;
          let endISO: string;
          if (override?.start_date && override?.end_date) {
            startISO = override.start_date;
            endISO = override.end_date;
          } else if (isAllDay) {
            startISO = startOfDay(instance.date).toISOString();
            endISO = endOfDay(instance.date).toISOString();
          } else {
            startISO = instance.date.toISOString();
            endISO = new Date(instance.date.getTime() + (series.duration_minutes * 60 * 1000)).toISOString();
          }

          // Use override attendees when provided
          const attendeeProfiles: string[] = (override?.attendees as string[] | undefined) ?? series.attendee_profiles ?? [];

          const virtualEvent: CalendarEvent = {
            id: `${series.id}-${format(instance.date, 'yyyy-MM-dd')}`,
            title: override?.title || series.title,
            description: override?.description || series.description,
            location: override?.location || series.location,
            start_date: startISO,
            end_date: endISO,
            is_all_day: isAllDay,
            family_id: series.family_id,
            created_by: series.created_by,
            created_at: series.created_at,
            updated_at: series.updated_at,
            attendees: attendeeProfiles.map(profileId => ({
              id: crypto.randomUUID(),
              event_id: `${series.id}-${format(instance.date, 'yyyy-MM-dd')}`,
              profile_id: profileId,
              added_by: series.created_by,
              added_at: new Date().toISOString(),
              profile: { id: profileId, display_name: '', role: 'child' as const, color: 'sky' }
            })),
            recurrence_options: null,
            isVirtual: true,
            series_id: series.id,
            occurrence_date: format(instance.date, 'yyyy-MM-dd'),
            isException: instance.isException,
            exceptionType: instance.exceptionType
          };
        
        virtualEvents.push(virtualEvent);
      });
    });
    
    return virtualEvents.sort((a, b) => 
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  };

  const fetchEvents = async () => {
    if (!familyId) {
      return;
    }

    try {
      // First get regular events (non-recurring legacy events)
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('family_id', familyId)
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        return;
      }

      // Get event IDs for batch queries
      const eventIds = eventsData.map(event => event.id);

      // Optimized: fetch attendees and profiles in parallel for all events
      const [attendeesResponse, profilesResponse] = await Promise.all([
        supabase
          .from('event_attendees')
          .select('*')
          .in('event_id', eventIds),
        
        supabase
          .from('profiles')
          .select('id, display_name, role, color')
          .eq('family_id', familyId)
      ]);

      const { data: attendeesData, error: attendeesError } = attendeesResponse;
      const { data: profilesData, error: profilesError } = profilesResponse;

      if (attendeesError) throw attendeesError;
      if (profilesError) throw profilesError;

      // Create lookup maps for O(1) access
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const attendeesByEvent = new Map<string, any[]>();

      // Group attendees by event ID
      (attendeesData || []).forEach(attendee => {
        const eventAttendees = attendeesByEvent.get(attendee.event_id) || [];
        const profile = profilesMap.get(attendee.profile_id);
        if (profile) {
          eventAttendees.push({ ...attendee, profile });
          attendeesByEvent.set(attendee.event_id, eventAttendees);
        }
      });

      // Combine events with their attendees and cast types properly
      const eventsWithAttendees = eventsData.map(event => ({
        ...event,
        attendees: attendeesByEvent.get(event.id) || [],
        recurrence_options: event.recurrence_options as any // Cast to handle JSON<->interface mismatch
      }));
      
      setEvents(eventsWithAttendees as CalendarEvent[]);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_date: string;
    end_date: string;
    is_all_day: boolean;
    attendees?: string[];
    recurrence_options?: any;
  }, creatorProfileId?: string) => {
    if (!familyId) {
      toast({
        title: 'Error',
        description: 'Family ID is required to create events',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { attendees, recurrence_options, ...eventFields } = eventData;
      
      // Use the provided creator profile ID
      if (!creatorProfileId) {
        throw new Error('Creator profile ID is required');
      }

      // Check if this should be a recurring series
      if (recurrence_options?.enabled && recurrence_options?.rule) {
        // Create as event series instead of regular event
        const startDate = new Date(eventFields.start_date);
        const endDate = new Date(eventFields.end_date);
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        
        const seriesData = {
          title: eventFields.title,
          description: eventFields.description,
          location: eventFields.location,
          duration_minutes: durationMinutes,
          is_all_day: eventFields.is_all_day,
          attendee_profiles: attendees || [],
          family_id: familyId,
          created_by: creatorProfileId,
          recurrence_rule: recurrence_options.rule,
          series_start: startDate.toISOString(),
          is_active: true
        };
        
        const series = await createEventSeries(seriesData);
        await fetchEvents(); // Refresh to include new virtual instances
        
        toast({
          title: 'Success',
          description: 'Recurring event series created successfully',
        });
        
        // Calendar will refresh via React Query invalidation
        return series;
      } else {
        // Create as regular one-time event
        const insertData = {
          ...eventFields,
          family_id: familyId,
          created_by: creatorProfileId,
          recurrence_options: null // No recurrence for regular events
        };

        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert([insertData])
          .select()
          .single();

        if (eventError) throw eventError;

        // Add attendees if provided
        if (attendees && attendees.length > 0) {
          const attendeeRecords = attendees.map(profileId => ({
            event_id: event.id,
            profile_id: profileId,
            added_by: creatorProfileId
          }));

          const { error: attendeesError } = await supabase
            .from('event_attendees')
            .insert(attendeeRecords);

          if (attendeesError) throw attendeesError;
        }

        await fetchEvents();
        
        toast({
          title: 'Success',
          description: 'Event created successfully',
        });

        return event;
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to create event',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>, attendees?: string[]) => {
    try {
      // Check if this is a virtual event that needs special handling
      const eventToUpdate = events.find(e => e.id === id);
      if (eventToUpdate?.isVirtual && eventToUpdate?.series_id) {
        // This should not happen as virtual events should go through edit scope dialog
        throw new Error('Virtual events must be updated through the series system');
      }

      // Cast recurrence_options for database update
      const dbUpdates = {
        ...updates,
        recurrence_options: updates.recurrence_options ? (updates.recurrence_options as unknown as any) : updates.recurrence_options
      };
      
      const { error: eventError } = await supabase
        .from('events')
        .update(dbUpdates)
        .eq('id', id);

      if (eventError) throw eventError;

      // Update attendees if provided
      if (attendees !== undefined) {
        const { error: deleteError } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', id);

        if (deleteError) throw deleteError;

        if (attendees.length > 0) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user?.id)
            .single();

          const attendeeRecords = attendees.map(profileId => ({
            event_id: id,
            profile_id: profileId,
            added_by: userProfile?.id || user?.id || ''
          }));

          const { error: attendeesError } = await supabase
            .from('event_attendees')
            .insert(attendeeRecords);

          if (attendeesError) throw attendeesError;
        }
      }

      await fetchEvents();
      
      toast({
        title: 'Success',
        description: 'Event updated successfully',
      });
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to update event',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      // Check if this is a virtual event that needs special handling
      // Virtual events have composite IDs like "series_id-date"
      if (id.includes('-') && id.length > 36) {
        // This is likely a virtual event - extract series ID and date
        const parts = id.split('-');
        if (parts.length >= 6) { // UUID has 5 parts, so 6+ means it has a date suffix
          const seriesId = parts.slice(0, 5).join('-'); // Reconstruct UUID
          const dateStr = parts.slice(5).join('-'); // Get date part
          
          // Create a 'skip' exception for this occurrence
          await createException({
            series_id: seriesId,
            series_type: 'event',
            exception_date: dateStr,
            exception_type: 'skip',
            created_by: (await supabase.auth.getUser()).data.user?.id || ''
          });
          
          // Refresh events to show changes immediately
          await fetchEvents();
          
          // Also trigger calendar refresh if available
          if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
            (window as any).refreshCalendar();
          }
          
          toast({
            title: 'Success',
            description: 'Event occurrence cancelled',
          });
          return;
        }
      }

      // Regular event deletion - check if it exists in the events table
      const eventToDelete = events.find(e => e.id === id);
      if (!eventToDelete || eventToDelete.isVirtual) {
        throw new Error('Cannot delete virtual event directly');
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh events and trigger calendar refresh
      await fetchEvents();
      
      if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
        (window as any).refreshCalendar();
      }
      
      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Enhanced refresh function that also updates virtual instances
  const refreshEventsAndSeries = async () => {
    console.log('Refreshing events and series data...');
    await fetchEvents();
    
    // Trigger calendar refresh if available
    if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
      console.log('Triggering calendar refresh from useEvents');
      (window as any).refreshCalendar();
    }
  };

  // Make refresh function available globally for series updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshEvents = refreshEventsAndSeries;
    }
  }, []);
  useEffect(() => {
    fetchEvents();
  }, [familyId]);

  return {
    events,
    loading,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents: refreshEventsAndSeries,
    generateVirtualEvents, // Export the virtual events generator
    // Series management functions
    createEventSeries,
    createException,
    updateSeries,
    splitSeries,
    deleteSeries
  };
};