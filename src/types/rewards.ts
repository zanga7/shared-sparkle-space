export interface Reward {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  cost_points: number;
  image_url?: string;
  reward_type: 'once_off' | 'always_available' | 'group_contribution';
  is_active: boolean;
  assigned_to?: string[] | null; // Array of profile IDs, null means available to all
  created_by: string;
  created_at: string;
  updated_at: string;
  auto_approve: boolean;
}

export interface RewardRequest {
  id: string;
  reward_id: string;
  requested_by: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'denied' | 'cancelled' | 'claimed';
  approved_by?: string;
  approval_note?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  reward?: Reward;
  requestor?: {
    id: string;
    display_name: string;
    color: string;
    avatar_url?: string | null;
  };
}

export interface PointsLedgerEntry {
  id: string;
  profile_id: string;
  family_id: string;
  entry_type: 'earn' | 'spend' | 'adjust';
  points: number;
  reason: string;
  task_id?: string;
  reward_request_id?: string;
  created_by: string;
  created_at: string;
  // Joined data
  creator?: {
    id: string;
    display_name: string;
  };
}

export interface PointsBalance {
  profile_id: string;
  balance: number;
}

export interface GroupContribution {
  id: string;
  reward_id: string;
  profile_id: string;
  points_contributed: number;
  contributed_at: string;
  family_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  contributor?: {
    id: string;
    display_name: string;
    color: string;
    avatar_url?: string | null;
  };
}