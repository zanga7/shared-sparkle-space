// All rotating task functionality has been removed
// These types are preserved for compatibility but are no longer used

export interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  location?: string;
  family_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  attendees?: Array<{
    id: string;
    profile_id: string;
    event_id: string;
    added_at: string;
    added_by: string;
    profile: {
      id: string;
      display_name: string;
      role: 'parent' | 'child';
      color: string;
    };
  }>;
}

export interface CalendarIntegration {
  id: string;
  profile_id: string;
  integration_type: string;
  access_token: string;
  refresh_token?: string;
  calendar_id?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}