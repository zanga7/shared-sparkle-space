import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CheckSquare, Calendar, List, Gift, RotateCw, Monitor, Target } from 'lucide-react';
import { toast } from 'sonner';

interface Module {
  name: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const AVAILABLE_MODULES: Module[] = [
  {
    name: 'tasks',
    label: 'Tasks',
    description: 'Task management and completion tracking',
    icon: CheckSquare
  },
  {
    name: 'calendar',
    label: 'Calendar',
    description: 'Event scheduling and calendar management',
    icon: Calendar
  },
  {
    name: 'lists',
    label: 'Lists',
    description: 'Shopping lists and to-do lists',
    icon: List
  },
  {
    name: 'rewards',
    label: 'Rewards',
    description: 'Points and rewards system',
    icon: Gift
  },
  {
    name: 'rotating_tasks',
    label: 'Rotating Tasks',
    description: 'Automatic task rotation among members',
    icon: RotateCw
  },
  {
    name: 'screensaver',
    label: 'Screensaver',
    description: 'Custom screensaver with photos',
    icon: Monitor
  },
  {
    name: 'goals',
    label: 'Goals',
    description: 'Track progress toward personal and family goals',
    icon: Target
  }
];

interface ModuleToggleListProps {
  familyId: string;
  currentModules: Array<{ module_name: string; is_enabled: boolean }>;
}

export function ModuleToggleList({ familyId, currentModules }: ModuleToggleListProps) {
  const queryClient = useQueryClient();

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleName, isEnabled }: { moduleName: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from('family_module_overrides')
        .upsert({
          family_id: familyId,
          module_name: moduleName as any,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'family_id,module_name'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-module-overrides', familyId] });
      toast.success('Module updated successfully');
    },
    onError: () => {
      toast.error('Failed to update module');
    }
  });

  const getModuleStatus = (moduleName: string) => {
    const module = currentModules.find(m => m.module_name === moduleName);
    return module?.is_enabled ?? true; // Default to enabled if not found
  };

  return (
    <div className="space-y-4">
      {AVAILABLE_MODULES.map((module) => {
        const isEnabled = getModuleStatus(module.name);
        const Icon = module.icon;
        
        return (
          <div
            key={module.name}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
          >
            <div className="flex items-start gap-3 flex-1">
              <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <Label htmlFor={`module-${module.name}`} className="cursor-pointer">
                  {module.label}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
              </div>
            </div>
            <Switch
              id={`module-${module.name}`}
              checked={isEnabled}
              onCheckedChange={(checked) => {
                toggleModuleMutation.mutate({
                  moduleName: module.name,
                  isEnabled: checked
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
