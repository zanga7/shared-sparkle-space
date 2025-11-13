import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ModuleAccess {
  [key: string]: boolean;
}

export function useModuleAccess(familyId?: string) {
  const { data: modules, isLoading } = useQuery({
    queryKey: ['family-modules', familyId],
    queryFn: async () => {
      if (!familyId) return {};
      
      const { data, error } = await supabase.rpc('get_family_modules', {
        check_family_id: familyId
      });
      
      if (error) throw error;
      
      // Convert array to object for easy lookup
      const moduleMap = (data || []).reduce((acc, m) => {
        acc[m.module_name] = m.is_enabled;
        return acc;
      }, {} as ModuleAccess);
      
      return moduleMap;
    },
    enabled: !!familyId
  });
  
  return {
    hasModule: (moduleName: string) => modules?.[moduleName] ?? true, // Default to true if no plan assigned
    modules: modules ?? {},
    isLoading
  };
}
