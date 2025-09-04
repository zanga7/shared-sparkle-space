import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';


export const useEvents = (familyId?: string) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvents = async () => {
    if (!familyId) {
      return;
    }

    try {
      // First get events
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
      
      console.log('useEvents.createEvent - Full eventData received:', eventData);
      console.log('useEvents.createEvent - Extracted recurrence_options:', recurrence_options);
      
      // Get the current user's profile ID to use as created_by
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found');
      }

      const insertData = {
        ...eventFields,
        family_id: familyId,
        created_by: profile.id,
        recurrence_options: recurrence_options || null
      };
      
      console.log('useEvents.createEvent - Data being inserted to database:', insertData);

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([insertData])
        .select()
        .single();

      if (eventError) throw eventError;

      // Add attendees if provided
      if (attendees && attendees.length > 0) {
        console.log('Creating attendees:', { attendees, eventId: event.id, profileId: profile.id });
        
        const attendeeRecords = attendees.map(profileId => ({
          event_id: event.id,
          profile_id: profileId,
          added_by: profile.id
        }));

        console.log('Attendee records to insert:', attendeeRecords);

        const { error: attendeesError } = await supabase
          .from('event_attendees')
          .insert(attendeeRecords);

        if (attendeesError) {
          console.error('Error adding attendees:', attendeesError);
          throw attendeesError;
        }
        
        console.log('Attendees added successfully');
      } else {
        console.log('No attendees to add:', { attendees });
      }

      await fetchEvents();
      toast({
        title: 'Success',
        description: 'Event created successfully',
      });

      return event;
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
  };
};