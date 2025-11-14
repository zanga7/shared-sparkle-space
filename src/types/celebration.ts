export interface Celebration {
  id: string;
  family_id: string;
  name: string;
  celebration_type: 'birthday' | 'anniversary' | 'other';
  celebration_date: string;
  year_specific?: number;
  visual_type: 'photo' | 'icon';
  photo_url?: string;
  icon_id?: string;
  icon?: {
    id: string;
    name: string;
    svg_content: string;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Virtual properties for calendar display
  isVirtual?: boolean;
  currentYearDate?: string;
  age?: number;
}

export interface PublicHoliday {
  id: string;
  region_code: string;
  holiday_date: string;
  holiday_name: string;
  is_public: boolean;
  holiday_type?: string;
  flag_emoji?: string;
}

export interface PublicHolidaySettings {
  id: string;
  family_id: string;
  api_provider: 'nager' | 'calendarific' | 'holidayapi';
  api_key?: string;
  enabled_regions: string[];
  last_sync_at?: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CelebrationIcon {
  id: string;
  name: string;
  svg_content: string;
  icon_type: string;
  is_system: boolean;
}
