export interface AuditLog {
  id: string;
  family_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface HouseholdSettings {
  id: string;
  family_id: string;
  subscription_metadata?: any;
  theme_palette: string[];
  pin_attempts_limit: number;
  pin_lockout_duration: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  family_id: string;
  name: string;
  color: 'sky' | 'rose' | 'emerald' | 'amber' | 'violet';
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ExtendedProfile {
  id: string;
  user_id: string;
  family_id: string;
  display_name: string;
  role: 'parent' | 'child';
  total_points: number;
  avatar_url?: string | null;
  can_add_for_self: boolean;
  can_add_for_siblings: boolean;
  can_add_for_parents: boolean;
  status: string;
  color: string;
  streak_count: number;
  pin_type?: string | null;
  theme?: any;
  created_at: string;
  updated_at: string;
  sort_order?: number | null;
  require_pin_to_complete_tasks?: boolean;
  require_pin_for_list_deletes?: boolean;
  calendar_edit_permission?: string;
}

export type ColorSwatch = 'sky' | 'rose' | 'emerald' | 'amber' | 'violet';

export const ColorSwatches: { [key in ColorSwatch]: string } = {
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200'
};