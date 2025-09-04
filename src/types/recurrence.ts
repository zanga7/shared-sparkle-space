// Recurrence system types for both tasks and events

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurrenceEndType = 'never' | 'on_date' | 'after_count';

export type WeekdayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type MonthlyType = 'on_day' | 'on_weekday';

export type OrdinalPosition = 'first' | 'second' | 'third' | 'fourth' | 'last';

export interface RecurrenceException {
  id: string;
  date: string; // ISO date
  type: 'skip' | 'change';
  newTime?: string; // For change exceptions
  newLocation?: string; // For change exceptions
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // Every n frequency units
  weekdays?: WeekdayKey[]; // For weekly recurrence
  monthlyType?: MonthlyType; // For monthly recurrence
  monthDay?: number; // Day of month (1-31)
  weekdayOrdinal?: OrdinalPosition; // For "first Monday" type rules
  weekdayName?: WeekdayKey; // For "first Monday" type rules
  endType: RecurrenceEndType;
  endDate?: string; // ISO date
  endCount?: number; // Number of occurrences
  exceptions?: RecurrenceException[];
}

export interface TaskRecurrenceOptions {
  enabled: boolean;
  rule: RecurrenceRule;
  repeatFrom: 'scheduled' | 'completion';
  rotateBetweenMembers?: boolean;
  memberOrder?: string[]; // Array of profile IDs
  skipWeekends?: boolean;
  pauseDuringHolidays?: boolean;
}

export interface EventRecurrenceOptions {
  enabled: boolean;
  rule: RecurrenceRule;
}

export type RecurrencePreset = 
  | 'every_day'
  | 'school_days'
  | 'weekends'
  | 'every_week'
  | 'every_month'
  | 'every_year'
  | 'custom';

export interface RecurrencePresetConfig {
  label: string;
  description: string;
  rule: Partial<RecurrenceRule>;
  icon?: string;
}

export interface RecurrencePreview {
  summary: string;
  nextOccurrences: Date[];
  warnings?: string[];
}

// Edit scope when modifying recurring items
export type RecurrenceEditScope = 'this_only' | 'this_and_following' | 'all_occurrences';

// Conflict detection
export interface RecurrenceConflict {
  date: Date;
  conflictingItemId: string;
  conflictingItemTitle: string;
  assigneeId: string;
  assigneeName: string;
}