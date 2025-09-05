import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRecurringSeries } from './useRecurringSeries';
import { format } from 'date-fns';

/**
 * Hook to migrate existing events with recurrence_options to the new series system
 */
export const useEventMigration = (familyId?: string) => {
  const [migrating, setMigrating] = useState(false);
  const [migrationStats, setMigrationStats] = useState({
    total: 0,
    migrated: 0,
    errors: 0
  });
  const { toast } = useToast();
  const { createEventSeries } = useRecurringSeries(familyId);

  const migrateEventsToSeries = async () => {
    if (!familyId) {
      toast({
        title: 'Error',
        description: 'Family ID is required for migration',
        variant: 'destructive'
      });
      return;
    }

    setMigrating(true);
    setMigrationStats({ total: 0, migrated: 0, errors: 0 });

    try {
      // Find all events with recurrence_options that haven't been migrated
      const { data: eventsToMigrate, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('family_id', familyId)
        .not('recurrence_options', 'is', null)
        .is('migrated_to_series', null); // Add this column if it doesn't exist

      if (fetchError) throw fetchError;

      if (!eventsToMigrate || eventsToMigrate.length === 0) {
        toast({
          title: 'Migration Complete',
          description: 'No events found that need migration',
        });
        return;
      }

      setMigrationStats(prev => ({ ...prev, total: eventsToMigrate.length }));

      // Migrate each event to a series
      for (const event of eventsToMigrate) {
        try {
          const recurrenceOptions = event.recurrence_options as any;
          
          if (!recurrenceOptions?.enabled || !recurrenceOptions?.rule) {
            continue; // Skip if not actually recurring
          }

          // Calculate duration
          const startDate = new Date(event.start_date);
          const endDate = new Date(event.end_date);
          const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

          // Get attendees for this event
          const { data: attendees } = await supabase
            .from('event_attendees')
            .select('profile_id')
            .eq('event_id', event.id);

          const attendeeProfiles = attendees?.map(a => a.profile_id) || [];

          // Create event series
          const seriesData = {
            title: event.title,
            description: event.description,
            location: event.location,
            duration_minutes: durationMinutes,
            is_all_day: event.is_all_day,
            attendee_profiles: attendeeProfiles,
            family_id: event.family_id,
            created_by: event.created_by,
            recurrence_rule: recurrenceOptions.rule,
            series_start: startDate.toISOString(),
            is_active: true
          };

          await createEventSeries(seriesData);

          // Mark original event as migrated
          await supabase
            .from('events')
            .update({ 
              migrated_to_series: true,
              // Keep the original event but mark it as legacy
              description: event.description ? 
                `${event.description}\n\n[MIGRATED TO SERIES - This is the original event]` :
                '[MIGRATED TO SERIES - This is the original event]'
            })
            .eq('id', event.id);

          setMigrationStats(prev => ({ ...prev, migrated: prev.migrated + 1 }));

        } catch (error) {
          console.error(`Error migrating event ${event.id}:`, error);
          setMigrationStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      }

      toast({
        title: 'Migration Complete',
        description: `Migrated ${migrationStats.migrated} events to series. ${migrationStats.errors} errors.`,
      });

    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Migration Failed',
        description: 'Failed to migrate events to series',
        variant: 'destructive'
      });
    } finally {
      setMigrating(false);
    }
  };

  const checkMigrationStatus = async () => {
    if (!familyId) return { needsMigration: false, count: 0 };

    try {
      const { data: eventsToMigrate, error } = await supabase
        .from('events')
        .select('id')
        .eq('family_id', familyId)
        .not('recurrence_options', 'is', null)
        .is('migrated_to_series', null);

      if (error) throw error;

      return {
        needsMigration: (eventsToMigrate?.length || 0) > 0,
        count: eventsToMigrate?.length || 0
      };
    } catch (error) {
      console.error('Error checking migration status:', error);
      return { needsMigration: false, count: 0 };
    }
  };

  return {
    migrating,
    migrationStats,
    migrateEventsToSeries,
    checkMigrationStatus
  };
};
