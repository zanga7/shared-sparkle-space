import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Event } from '@/types/rotating-tasks';

export const useEvents = (familyId?: string) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvents = async () => {
    if (!familyId) {
      return;
    }

    try {
      // First fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('family_id', familyId)
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      // Then fetch attendees for all events with a simpler approach
      const eventsWithAttendees = [];
      
      for (const event of eventsData || []) {
        // Get attendees for this event
        const { data: attendees } = await supabase
          .from('event_attendees')
          .select('*')
          .eq('event_id', event.id);
        
        // Get profile info for each attendee
        const attendeesWithProfiles = [];
        for (const attendee of attendees || []) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, role, color')
            .eq('id', attendee.profile_id)
            .single();
          
          if (profile) {
            attendeesWithProfiles.push({
              ...attendee,
              profile
            });
          }
        }
        
        eventsWithAttendees.push({
          ...event,
          attendees: attendeesWithProfiles
        });
      }
      
      setEvents(eventsWithAttendees);
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
      const { attendees, ...eventFields } = eventData;
      
      // Get the current user's profile ID to use as created_by
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found');
      }

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          ...eventFields,
          family_id: familyId,
          created_by: profile.id
        }])
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

  const updateEvent = async (id: string, updates: Partial<Event>, attendees?: string[]) => {
    try {
      const { error: eventError } = await supabase
        .from('events')
        .update(updates)
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