import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckSquare, Calendar, List, Gift, RotateCw, Monitor, Target,
  Check, Sparkles, Crown, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  is_custom: boolean;
  sort_order: number;
}

interface PlanModule {
  plan_id: string;
  module_name: string;
  is_enabled: boolean;
}

const MODULE_INFO: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  tasks: { label: 'Tasks', icon: CheckSquare, description: 'Create and assign tasks' },
  calendar: { label: 'Calendar', icon: Calendar, description: 'Schedule events' },
  lists: { label: 'Lists', icon: List, description: 'Shopping & to-do lists' },
  rewards: { label: 'Rewards', icon: Gift, description: 'Points & rewards' },
  rotating_tasks: { label: 'Rotating Tasks', icon: RotateCw, description: 'Auto-rotating chores' },
  screensaver: { label: 'Screensaver', icon: Monitor, description: 'Photo slideshows' },
  goals: { label: 'Goals', icon: Target, description: 'Track family goals' }
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  'Free': Zap,
  'Basic': Sparkles,
  'Premium': Crown
};

export default function SelectPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans-onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .neq('name', 'Custom')
        .order('sort_order');
      if (error) throw error;
      return data as Plan[];
    }
  });

  const { data: planModules } = useQuery({
    queryKey: ['plan-modules-onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_modules')
        .select('plan_id, module_name, is_enabled');
      if (error) throw error;
      return data as PlanModule[];
    }
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get user's family
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError || !profile?.family_id) {
        throw new Error('Could not find family');
      }

      // Update family's plan
      const { error: updateError } = await supabase
        .from('families')
        .update({ current_plan_id: planId })
        .eq('id', profile.family_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Plan selected!');
      navigate('/onboarding/crew');
    },
    onError: (error) => {
      console.error('Error selecting plan:', error);
      toast.error('Failed to select plan');
    }
  });

  const getEnabledModules = (planId: string) => {
    return planModules?.filter(m => m.plan_id === planId && m.is_enabled) || [];
  };

  const handleContinue = () => {
    if (!selectedPlanId) {
      toast.error('Please select a plan to continue');
      return;
    }
    selectPlanMutation.mutate(selectedPlanId);
  };

  const handleSkip = () => {
    // Use first/free plan as default
    const freePlan = plans?.find(p => p.name.toLowerCase() === 'free') || plans?.[0];
    if (freePlan) {
      selectPlanMutation.mutate(freePlan.id);
    } else {
      navigate('/onboarding/crew');
    }
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading plans...</div>
      </div>
    );
  }

  // If no plans available, show message
  if (!plans || plans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">No Plans Available</h1>
            <p className="text-muted-foreground">
              Subscription plans haven't been configured yet. Please contact support.
            </p>
          </div>
          <Button onClick={() => navigate('/onboarding/crew')}>
            Continue Setup
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="max-w-5xl w-full p-6 md:p-12 space-y-6 md:space-y-8 shadow-xl my-4">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">Choose Your Plan</h1>
            <p className="text-muted-foreground text-lg">
              Select the features that work best for your family
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {plans?.map((plan, index) => {
            const enabledModules = getEnabledModules(plan.id);
            const isSelected = selectedPlanId === plan.id;
            const PlanIcon = PLAN_ICONS[plan.name] || Sparkles;
            const isPremium = plan.name === 'Premium';

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative p-6 cursor-pointer transition-all hover:shadow-lg border-2",
                  isSelected 
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                    : "border-border hover:border-primary/50",
                  isPremium && "md:scale-105"
                )}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {isPremium && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Recommended
                  </Badge>
                )}

                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      isPremium ? "bg-primary/20" : "bg-muted"
                    )}>
                      <PlanIcon className={cn(
                        "w-6 h-6",
                        isPremium ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Includes {enabledModules.length} features:
                    </p>
                    <ul className="space-y-2">
                      {enabledModules.map((module) => {
                        const info = MODULE_INFO[module.module_name];
                        if (!info) return null;
                        const Icon = info.icon;
                        return (
                          <li key={module.module_name} className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{info.label}</span>
                          </li>
                        );
                      })}
                      {enabledModules.length === 0 && (
                        <li className="text-sm text-muted-foreground italic">
                          No modules included
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-between pt-6 border-t">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            disabled={selectPlanMutation.isPending}
          >
            Skip for now
          </Button>
          <div className="flex gap-3 md:gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding/welcome')}
              disabled={selectPlanMutation.isPending}
            >
              Back
            </Button>
            <Button 
              onClick={handleContinue}
              disabled={!selectedPlanId || selectPlanMutation.isPending}
            >
              {selectPlanMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
