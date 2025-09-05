import { RecurrenceRule } from './recurrence';

export interface BaseSeries {
  id: string;
  family_id: string;
  created_by: string;
  recurrence_rule: RecurrenceRule;
  series_start: string;
  series_end?: string;
  original_series_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskSeries extends BaseSeries {
  title: string;
  description?: string;
  points: number;
  task_group: string;
  completion_rule: string;
  assigned_profiles: string[];
}

export interface EventSeries extends BaseSeries {
  title: string;
  description?: string;
  location?: string;
  duration_minutes: number;
  is_all_day: boolean;
  attendee_profiles: string[];
}

export interface RecurrenceException {
  id: string;
  series_id: string;
  series_type: 'task' | 'event';
  exception_date: string; // ISO date string (YYYY-MM-DD)
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
  originalData: TaskSeries | EventSeries;
  seriesType: 'task' | 'event';
}

export type EditScope = 'this_only' | 'this_and_following' | 'all_occurrences';

// Virtual instance types that merge series data with instance-specific overrides
export interface VirtualTaskInstance {
  id: string; // Generated from series_id + date
  series_id: string;
  title: string;
  description?: string;
  points: number;
  task_group: string;
  completion_rule: string;
  assigned_profiles: string[];
  due_date: string;
  family_id: string;
  created_by: string;
  isVirtual: true;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
}

export interface VirtualEventInstance {
  id: string; // Generated from series_id + date
  series_id: string;
  title: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  attendee_profiles: string[];
  family_id: string;
  created_by: string;
  isVirtual: true;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
}