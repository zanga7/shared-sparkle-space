import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';
import { useRecurringSeries } from './useRecurringSeries';
import { VirtualEventInstance } from '@/types/series';
import { format, startOfDay, endOfDay } from 'date-fns';


export const useEvents = (familyId?: string) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { eventSeries, exceptions, generateSeriesInstances, createEventSeries, createException, updateSeries, splitSeries } = useRecurringSeries(familyId);

  // Generate virtual event instances from both regular events and series
  const generateVirtualEvents = (startDate: Date, endDate: Date): CalendarEvent[] => {
    const virtualEvents: CalendarEvent[] = [];
    
    // Add regular events (non-recurring)
    events.forEach(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      // Include event if it overlaps with the date range
      if (eventEnd >= startDate && eventStart <= endDate) {
        virtualEvents.push(event);
      }
    });
    
    // Generate virtual instances from series
    eventSeries.forEach(series => {
      const instances = generateSeriesInstances(series, startDate, endDate);
      
      instances.forEach(instance => {
        if (instance.exceptionType === 'skip') return; // Skip this occurrence
        
        // Create virtual event from series instance
        const virtualEvent: CalendarEvent = {
          id: `${series.id}-${format(instance.date, 'yyyy-MM-dd')}`,
          title: instance.overrideData?.title || series.title,
          description: instance.overrideData?.description || series.description,
          location: instance.overrideData?.location || series.location,
          start_date: series.is_all_day 
            ? startOfDay(instance.date).toISOString()
            : instance.date.toISOString(),
          end_date: series.is_all_day
            ? endOfDay(instance.date).toISOString() 
            : new Date(instance.date.getTime() + (series.duration_minutes * 60 * 1000)).toISOString(),
          is_all_day: series.is_all_day,
          family_id: series.family_id,
          created_by: series.created_by,
          created_at: series.created_at,
          updated_at: series.updated_at,
          attendees: [], // Will be populated below
          recurrence_options: null,
          // Virtual event metadata
          isVirtual: true,
          series_id: series.id,
          occurrence_date: format(instance.date, 'yyyy-MM-dd'),
          isException: instance.isException,
          exceptionType: instance.exceptionType
        };
        
        // Populate attendees from series
        if (series.attendee_profiles && series.attendee_profiles.length > 0) {
          // This would need profile data - for now, just store IDs
          virtualEvent.attendees = series.attendee_profiles.map(profileId => ({
            id: crypto.randomUUID(),
            event_id: virtualEvent.id,
            profile_id: profileId,
            added_by: series.created_by,
            added_at: new Date().toISOString(),
            profile: { id: profileId, display_name: '', role: 'child' as const, color: 'sky' }
          }));
        }
        
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
  }) => {
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
      
      // Get the current user's profile ID to use as created_by
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found');
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
          created_by: profile.id,
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
        
        return series;
      } else {
        // Create as regular one-time event
        const insertData = {
          ...eventFields,
          family_id: familyId,
          created_by: profile.id,
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
            added_by: profile.id
          }));

          const { error: attendeesError } = await supabase
            .from('event_attendees')
            .insert(attendeeRecords);

          if (attendeesError) {
            console.error('Error adding attendees:', attendeesError);
            throw attendeesError;
          }
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
        // Remove existing attendees first
        const { error: deleteError } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', id);

        if (deleteError) {
          console.error('Error removing existing attendees:', deleteError);
          throw deleteError;
        }

        // Add new attendees
        if (attendees.length > 0) {
          // Get the current user's profile to use as added_by
          const { data: currentProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
            .single();

          if (profileError || !currentProfile) {
            console.error('Error getting current user profile:', profileError);
            throw new Error('Could not get current user profile');
          }

          const attendeeRecords = attendees.map(profileId => ({
            event_id: id,
            profile_id: profileId,
            added_by: currentProfile.id
          }));

          const { error: attendeesError } = await supabase
            .from('event_attendees')
            .insert(attendeeRecords);

          if (attendeesError) {
            console.error('Error adding new attendees:', attendeesError);
            throw attendeesError;
          }
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
      const eventToDelete = events.find(e => e.id === id);
      if (eventToDelete?.isVirtual && eventToDelete?.series_id) {
        // For virtual events, we need to create a 'skip' exception instead of deleting
        await createException({
          series_id: eventToDelete.series_id,
          series_type: 'event',
          exception_date: eventToDelete.occurrence_date!,
          exception_type: 'skip',
          created_by: eventToDelete.created_by
        });
        
        await fetchEvents();
        toast({
          title: 'Success',
          description: 'Event occurrence cancelled',
        });
        return;
      }

      // Regular event deletion
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchEvents();
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

  useEffect(() => {
    fetchEvents();
  }, [familyId]);

  return {
    events,
    loading,
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents: fetchEvents,
    generateVirtualEvents, // Export the virtual events generator
    // Series management functions
    createEventSeries,
    createException,
    updateSeries,
    splitSeries
  };
};