import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicHoliday, PublicHolidaySettings } from '@/types/celebration';

const flagEmojiMap: Record<string, string> = {
  'AU': '🇦🇺',
  'AU-NSW': '🇦🇺',
  'AU-VIC': '🇦🇺',
  'AU-QLD': '🇦🇺',
  'AU-WA': '🇦🇺',
  'AU-SA': '🇦🇺',
  'AU-TAS': '🇦🇺',
  'AU-ACT': '🇦🇺',
  'AU-NT': '🇦🇺',
  'PH': '🇵🇭',
  'US': '🇺🇸',
  'GB': '🇬🇧',
  'CA': '🇨🇦',
  'NZ': '🇳🇿',
};

export const usePublicHolidaySettings = (familyId?: string) => {
  return useQuery({
    queryKey: ['public-holiday-settings', familyId],
    queryFn: async () => {
      if (!familyId) return null;

      const { data, error } = await supabase
        .from('public_holiday_settings')
        .select('*')
        .eq('family_id', familyId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as PublicHolidaySettings | null;
    },
    enabled: !!familyId,
  });
};

export const usePublicHolidays = (familyId?: string, year?: number) => {
  const { data: settings } = usePublicHolidaySettings(familyId);

  return useQuery({
    queryKey: ['public-holidays', settings?.enabled_regions, year],
    queryFn: async () => {
      if (!settings?.is_enabled || !settings?.enabled_regions?.length) return [];

      const currentYear = year || new Date().getFullYear();

      const { data, error } = await supabase
        .from('public_holidays_cache')
        .select('*')
        .in('region_code', settings.enabled_regions)
        .eq('year', currentYear)
        .order('holiday_date');

      if (error) throw error;

      return data.map((holiday: any) => ({
        ...holiday,
        flag_emoji: flagEmojiMap[holiday.region_code.split('-')[0]] || '🌍',
      })) as PublicHoliday[];
    },
    enabled: !!settings?.is_enabled && !!settings?.enabled_regions?.length,
  });
};
