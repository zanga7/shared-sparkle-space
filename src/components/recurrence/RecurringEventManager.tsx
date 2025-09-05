import React, { useState } from 'react';
import { CalendarEvent } from '@/types/event';
import { EditScope } from './EditScopeDialog';
import { useRecurringSeries } from '@/hooks/useRecurringSeries';
import { format } from 'date-fns';

interface RecurringEventManagerProps {
  event: CalendarEvent;
  onEditScope: (scope: EditScope, eventData: any) => Promise<void>;
}

/**
 * Component to handle edit operations on recurring events
 * This manages the different edit scopes and calls appropriate series functions
 */
export const RecurringEventManager = ({ event, onEditScope }: RecurringEventManagerProps) => {
  const { createException, updateSeries, splitSeries } = useRecurringSeries();

  const handleEditScope = async (scope: EditScope, eventData: any) => {
    if (!event.series_id || !event.occurrence_date) return;

    try {
      switch (scope) {
        case 'this_only':
          // Create an exception for this specific occurrence
          await createException({
            series_id: event.series_id,
            series_type: 'event',
            exception_date: event.occurrence_date,
            exception_type: 'override',
            override_data: eventData,
            created_by: event.created_by
          });
          break;

        case 'this_and_following':
          // Split the series at this occurrence
          const splitDate = new Date(event.start_date);
          await splitSeries(
            event.series_id,
            'event',
            splitDate,
            {
              title: eventData.title,
              description: eventData.description,
              location: eventData.location,
              duration_minutes: Math.round(
                (new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)
              ),
              is_all_day: eventData.is_all_day,
              attendee_profiles: eventData.attendees || [],
              family_id: event.family_id,
              created_by: event.created_by,
              recurrence_rule: {
                frequency: 'weekly',
                interval: 1,
                endType: 'never'
              } // Default rule - would need to be properly configured
            }
          );
          break;

        case 'all_occurrences':
          // Update the entire series
          await updateSeries(event.series_id, 'event', {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round(
              (new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)
            ),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees || []
          });
          break;
      }

      await onEditScope(scope, eventData);
    } catch (error) {
      console.error('Error handling recurring event edit:', error);
      throw error;
    }
  };

  return null; // This is a logical component, no UI
};