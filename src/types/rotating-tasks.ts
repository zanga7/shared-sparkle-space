export interface RotatingTask {
  id: string;
  family_id: string;
  name: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  weekly_days: number[] | null;
  monthly_day: number | null;
  member_order: string[];
  current_member_index: number;
  points: number;
  description: string | null;
  is_active: boolean;
  is_paused: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  attendees?: any[];
}

export interface CalendarIntegration {
  id: string;
  profile_id: string;
  integration_type: 'google' | 'outlook';
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}