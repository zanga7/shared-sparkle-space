import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Package } from 'lucide-react';
import { PlanEditorDialog } from '@/components/super-admin/PlanEditorDialog';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
  is_active: boolean;
  sort_order: number;
}

interface PlanModule {
  module_name: string;
  is_enabled: boolean;
}

export default function PlanManagement() {
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Plan[];
    }
  });

  const { data: planModulesMap } = useQuery({
    queryKey: ['plan-modules-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_modules')
        .select('plan_id, module_name, is_enabled');
      if (error) throw error;
      
      // Group by plan_id
      const grouped: Record<string, PlanModule[]> = {};
      data.forEach(item => {
        if (!grouped[item.plan_id]) {
          grouped[item.plan_id] = [];
        }
        grouped[item.plan_id].push({
          module_name: item.module_name,
          is_enabled: item.is_enabled
        });
      });
      return grouped;
    }
  });

  const getEnabledModules = (planId: string) => {
    return planModulesMap?.[planId]?.filter(m => m.is_enabled) || [];
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Plan Management</h2>
            <p className="text-muted-foreground">Create and manage subscription plans</p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            plans?.map((plan) => {
              const enabledModules = getEnabledModules(plan.id);
              
              return (
                <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          {plan.name}
                        </CardTitle>
                        {plan.description && (
                          <CardDescription className="mt-2">
                            {plan.description}
                          </CardDescription>
                        )}
                      </div>
                      {plan.is_custom && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                          Custom
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">
                        Enabled Modules ({enabledModules.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {enabledModules.map((module) => (
                          <Badge key={module.module_name} variant="secondary" className="text-xs">
                            {module.module_name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setEditingPlan(plan)}
                      disabled={plan.is_custom && plan.name === 'Custom'}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {plan.is_custom && plan.name === 'Custom' ? 'System Plan' : 'Edit Plan'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {(isCreating || editingPlan) && (
        <PlanEditorDialog
          plan={editingPlan}
          open={isCreating || !!editingPlan}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              setEditingPlan(null);
            }
          }}
        />
      )}
    </>
  );
}
