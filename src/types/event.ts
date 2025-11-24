import { EventRecurrenceOptions } from './recurrence';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  attendees?: any[];
  created_at: string;
  created_by: string;
  family_id: string;
  updated_at: string;
  recurrence_options?: EventRecurrenceOptions | null;
  // Source tracking for synced events
  source_integration_id?: string | null;
  source_type?: 'google' | 'microsoft' | 'internal' | null;
  external_event_id?: string | null;
  last_synced_at?: string | null;
  // Virtual event properties for series instances
  isVirtual?: boolean;
  series_id?: string;
  occurrence_date?: string;
  isException?: boolean;
  exceptionType?: 'skip' | 'override';
}