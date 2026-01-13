// Goal Types

export type GoalType = 'consistency' | 'target_count' | 'project';
export type GoalScope = 'individual' | 'family';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface ConsistencyCriteria {
  time_window_days: number;
  frequency: 'daily' | 'weekly';
  times_per_week?: number; // Only for weekly frequency
  threshold_percent: number;
}

export interface TargetCountCriteria {
  target_count: number;
}

export interface ProjectCriteria {
  requires_all_milestones: boolean;
}

export type SuccessCriteria = ConsistencyCriteria | TargetCountCriteria | ProjectCriteria;

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  milestone_order: number;
  completion_criteria: {
    type: 'count' | 'manual';
    count?: number;
  };
  reward_id?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  reward?: {
    id: string;
    title: string;
    image_url?: string;
  };
}

export interface GoalLinkedTask {
  id: string;
  goal_id: string;
  task_id?: string;
  task_series_id?: string;
  rotating_task_id?: string;
  linked_at: string;
  linked_by: string;
  // Joined task info
  task_title?: string;
  task_type?: 'one_off' | 'recurring' | 'rotating';
}

export interface ParticipantProgress {
  profile_id: string;
  display_name: string;
  color: string;
  completions: number;
}

export interface ConsistencyProgress {
  goal_type: 'consistency';
  total_completions: number;
  expected_completions: number;
  days_elapsed: number;
  total_days: number;
  current_percent: number;
  threshold_percent: number;
  grace_used: number;
  grace_remaining: number;
  on_track: boolean;
  is_complete: boolean;
}

export interface TargetCountProgress {
  goal_type: 'target_count';
  current_count: number;
  target_count: number;
  current_percent: number;
  is_complete: boolean;
}

export interface ProjectProgress {
  goal_type: 'project';
  completed_milestones: number;
  total_milestones: number;
  current_percent: number;
  is_complete: boolean;
}

export type GoalProgress = (ConsistencyProgress | TargetCountProgress | ProjectProgress) & {
  goal_id: string;
  status: GoalStatus;
  start_date: string;
  end_date?: string;
  calculated_at: string;
  participant_progress?: ParticipantProgress[];
};

export interface Goal {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  goal_type: GoalType;
  goal_scope: GoalScope;
  assigned_to?: string;
  reward_id?: string;
  success_criteria: SuccessCriteria;
  start_date: string;
  end_date?: string;
  status: GoalStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed/joined
  progress?: GoalProgress;
  milestones?: GoalMilestone[];
  linked_tasks?: GoalLinkedTask[];
  reward?: {
    id: string;
    title: string;
    image_url?: string;
    cost_points: number;
  };
  assignee?: {
    id: string;
    display_name: string;
    color: string;
    avatar_url?: string;
  };
  creator?: {
    id: string;
    display_name: string;
  };
}

export interface CreateGoalData {
  title: string;
  description?: string;
  goal_type: GoalType;
  goal_scope: GoalScope;
  assigned_to?: string;
  reward_id?: string;
  success_criteria: SuccessCriteria;
  start_date: string;
  end_date?: string;
  milestones?: Omit<GoalMilestone, 'id' | 'goal_id' | 'is_completed' | 'completed_at' | 'created_at' | 'updated_at'>[];
  linked_task_ids?: string[];
  linked_series_ids?: string[];
  linked_rotating_ids?: string[];
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  reward_id?: string;
  success_criteria?: SuccessCriteria;
  end_date?: string;
  status?: GoalStatus;
}
