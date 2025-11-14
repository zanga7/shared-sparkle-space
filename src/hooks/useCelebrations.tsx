import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Celebration } from '@/types/celebration';
import { format, setYear } from 'date-fns';

export const useCelebrations = (familyId?: string) => {
  return useQuery({
    queryKey: ['celebrations', familyId],
    queryFn: async () => {
      if (!familyId) return [];

      const { data, error } = await supabase
        .from('celebrations' as any)
        .select(`
          *,
          icon:avatar_icons(id, name, svg_content)
        `)
        .eq('family_id', familyId)
        .eq('is_active', true)
        .order('celebration_date');

      if (error) throw error;

      // Generate virtual instances for current year
      const currentYear = new Date().getFullYear();
      return data.map((celebration: any) => {
        const celebrationDate = new Date(celebration.celebration_date);
        const currentYearDate = setYear(celebrationDate, currentYear);
        
        let age: number | undefined;
        if (celebration.celebration_type === 'birthday' && celebration.year_specific) {
          age = currentYear - celebration.year_specific;
        }

        return {
          ...celebration,
          isVirtual: true,
          currentYearDate: format(currentYearDate, 'yyyy-MM-dd'),
          age,
        } as Celebration;
      });
    },
    enabled: !!familyId,
  });
};

export const useCelebrationIcons = () => {
  return useQuery({
    queryKey: ['celebration-icons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatar_icons' as any)
        .select('*')
        .eq('icon_type', 'celebration')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};
