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
  recurrence_options?: EventRecurrenceOptions | null; // Recurrence configuration
}