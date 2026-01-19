import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CheckSquare, Calendar, List, Gift, RotateCw, Monitor, Target } from 'lucide-react';

const AVAILABLE_MODULES = [
  { name: 'tasks', label: 'Tasks', icon: CheckSquare },
  { name: 'calendar', label: 'Calendar', icon: Calendar },
  { name: 'lists', label: 'Lists', icon: List },
  { name: 'rewards', label: 'Rewards', icon: Gift },
  { name: 'rotating_tasks', label: 'Rotating Tasks', icon: RotateCw },
  { name: 'screensaver', label: 'Screensaver', icon: Monitor },
  { name: 'goals', label: 'Goals', icon: Target }
];

interface Plan {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
}

interface PlanEditorDialogProps {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanEditorDialog({ plan, open, onOpenChange }: PlanEditorDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modules, setModules] = useState<Record<string, boolean>>({});

  const { data: existingModules } = useQuery({
    queryKey: ['plan-modules', plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data, error } = await supabase
        .from('plan_modules')
        .select('*')
        .eq('plan_id', plan.id);
      if (error) throw error;
      return data;
    },
    enabled: !!plan?.id && open
  });

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [plan]);

  useEffect(() => {
    if (existingModules) {
      const moduleMap: Record<string, boolean> = {};
      existingModules.forEach(m => {
        moduleMap[m.module_name] = m.is_enabled;
      });
      setModules(moduleMap);
    } else {
      // Default all to false for new plans
      const moduleMap: Record<string, boolean> = {};
      AVAILABLE_MODULES.forEach(m => {
        moduleMap[m.name] = false;
      });
      setModules(moduleMap);
    }
  }, [existingModules]);

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (plan) {
        // Update existing plan
        const { error: planError } = await supabase
          .from('subscription_plans')
          .update({
            name,
            description: description || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id);
        
        if (planError) throw planError;

        // Update modules
        const { error: deleteError } = await supabase
          .from('plan_modules')
          .delete()
          .eq('plan_id', plan.id);
        
        if (deleteError) throw deleteError;

        const modulesToInsert = Object.entries(modules).map(([moduleName, isEnabled]) => ({
          plan_id: plan.id,
          module_name: moduleName as any,
          is_enabled: isEnabled
        }));

        const { error: insertError } = await supabase
          .from('plan_modules')
          .insert(modulesToInsert);
        
        if (insertError) throw insertError;
      } else {
        // Create new plan
        const { data: newPlan, error: planError } = await supabase
          .from('subscription_plans')
          .insert({
            name,
            description: description || null,
            is_custom: false
          })
          .select()
          .single();
        
        if (planError) throw planError;

        const modulesToInsert = Object.entries(modules).map(([moduleName, isEnabled]) => ({
          plan_id: newPlan.id,
          module_name: moduleName as any,
          is_enabled: isEnabled
        }));

        const { error: insertError } = await supabase
          .from('plan_modules')
          .insert(modulesToInsert);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-modules-all'] });
      toast.success(plan ? 'Plan updated successfully' : 'Plan created successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving plan:', error);
      toast.error('Failed to save plan');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
          <DialogDescription>
            Configure the plan details and enabled modules
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Plan Name</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pro Plan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-description">Description</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what's included in this plan"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Enabled Modules</Label>
            <div className="space-y-2">
              {AVAILABLE_MODULES.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.name}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor={`module-${module.name}`} className="cursor-pointer">
                        {module.label}
                      </Label>
                    </div>
                    <Switch
                      id={`module-${module.name}`}
                      checked={modules[module.name] || false}
                      onCheckedChange={(checked) => {
                        setModules(prev => ({ ...prev, [module.name]: checked }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => savePlanMutation.mutate()}
            disabled={!name.trim() || savePlanMutation.isPending}
          >
            {savePlanMutation.isPending ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
