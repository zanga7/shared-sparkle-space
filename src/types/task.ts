import { TaskRecurrenceOptions } from './recurrence';

// Shared Task interface for the entire application
export interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  due_date: string | null;
  assigned_to: string | null; // Keep for backward compatibility
  created_by: string;
  completion_rule: 'any_one' | 'everyone'; // Field for completion behavior
  task_group?: string | null; // Task group field for organizing tasks
  recurrence_options?: TaskRecurrenceOptions | null; // Recurrence configuration
  assigned_profile?: {
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    color: string;
    avatar_url?: string | null;
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
      avatar_url?: string | null;
    };
  }>;
  task_completions?: Array<{
    id: string;
    completed_at: string;
    completed_by: string;
  }>;
  // Virtual task properties for series instances
  isVirtual?: boolean;
  series_id?: string;
  occurrence_date?: string;
  isException?: boolean;
  exceptionType?: 'skip' | 'override';
  overrideData?: any;
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
