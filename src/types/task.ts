// Shared Task interface for the entire application
export interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  due_date: string | null;
  assigned_to: string | null; // Keep for backward compatibility
  created_by: string;
  is_repeating: boolean;
  recurring_frequency: string | null;
  recurring_interval: number | null;
  recurring_days_of_week: number[] | null;
  recurring_end_date: string | null;
  series_id: string | null;
  completion_rule: 'any_one' | 'everyone'; // New field for completion behavior
  task_group?: string | null; // Task group field for organizing tasks
  family_id?: string; // Add family_id to Task interface
  assigned_profile?: {
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    color: string;
  };
  assignees?: Array<{
    id: string;
    profile_id: string;
    assigned_at: string;
    assigned_by: string;
    profile: {
      id: string;
      display_name: string;
      role: 'parent' | 'child';
      color: string;
    };
  }>;
  task_completions?: Array<{
    id: string;
    completed_at: string;
    completed_by: string;
  }>;
}

export interface Profile {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  total_points: number;
  avatar_url?: string;
  family_id: string;
  color: string;
}

export interface TaskSeries {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  points: number;
  assigned_to: string | null;
  recurring_frequency: string;
  recurring_interval: number;
  recurring_days_of_week: number[] | null;
  recurring_end_date: string | null;
  is_active: boolean;
  last_generated_date: string | null;
  next_due_date: string | null;
  created_by: string;
  created_at: string;
  start_date: string | null;
  repetition_count: number | null;
  remaining_repetitions: number | null;
  monthly_type: 'date' | 'weekday' | null;
  monthly_weekday_ordinal: number | null;
  skip_next_occurrence: boolean;
}