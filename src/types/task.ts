// Shared Task interface for the entire application
export interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  due_date: string | null;
  assigned_to: string | null; // Keep for backward compatibility
  created_by: string;
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