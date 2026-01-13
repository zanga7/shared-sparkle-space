import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Plus, Users, User, Pause, Play, Archive, Trash2 } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { useRewards } from '@/hooks/useRewards';
import { supabase } from '@/integrations/supabase/client';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalDetailDialog } from '@/components/goals/GoalDetailDialog';
import { CreateGoalDialog } from '@/components/goals/CreateGoalDialog';
import { Goal } from '@/types/goal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface FamilyMember {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  role: 'parent' | 'child';
}

export default function GoalsManagement() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  
  const { 
    goals, 
    loading, 
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    familyId 
  } = useGoals();
  const { rewards } = useRewards();

  useEffect(() => {
    const fetchFamilyMembers = async () => {
      if (!familyId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, color, avatar_url, role')
        .eq('family_id', familyId)
        .eq('status', 'active');
      
      if (!error && data) {
        setFamilyMembers(data as FamilyMember[]);
      }
    };

    fetchFamilyMembers();
  }, [familyId]);

  const filteredGoals = goals.filter(goal => {
    switch (activeTab) {
      case 'active':
        return goal.status === 'active';
      case 'paused':
        return goal.status === 'paused';
      case 'completed':
        return goal.status === 'completed';
      case 'archived':
        return goal.status === 'archived';
      default:
        return true;
    }
  });

  const individualGoals = filteredGoals.filter(g => g.goal_scope === 'individual');
  const familyGoals = filteredGoals.filter(g => g.goal_scope === 'family');

  const handlePause = async (goalId: string) => {
    await pauseGoal(goalId);
    toast.success('Goal paused');
  };

  const handleResume = async (goalId: string) => {
    await resumeGoal(goalId);
    toast.success('Goal resumed');
  };

  const handleArchive = async (goalId: string) => {
    await archiveGoal(goalId);
    toast.success('Goal archived');
  };

  const handleDelete = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal? This cannot be undone.')) {
      await deleteGoal(goalId);
      toast.success('Goal deleted');
    }
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'consistency': return 'Consistency';
      case 'target_count': return 'Target Count';
      case 'project': return 'Project';
      default: return type;
    }
  };

  const statusCounts = {
    active: goals.filter(g => g.status === 'active').length,
    paused: goals.filter(g => g.status === 'paused').length,
    completed: goals.filter(g => g.status === 'completed').length,
    archived: goals.filter(g => g.status === 'archived').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Goals Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage goals for family members
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Goal
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{statusCounts.active}</div>
            <p className="text-sm text-muted-foreground">Active Goals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">{statusCounts.paused}</div>
            <p className="text-sm text-muted-foreground">Paused</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">{statusCounts.archived}</div>
            <p className="text-sm text-muted-foreground">Archived</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({statusCounts.active})</TabsTrigger>
          <TabsTrigger value="paused">Paused ({statusCounts.paused})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({statusCounts.completed})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({statusCounts.archived})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6 mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : filteredGoals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No {activeTab} goals</h3>
                <p className="text-muted-foreground mb-4">
                  {activeTab === 'active' 
                    ? 'Create a goal to start tracking progress'
                    : `No goals are currently ${activeTab}`
                  }
                </p>
                {activeTab === 'active' && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Goal
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Family Goals Section */}
              {familyGoals.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5" />
                    Family Goals
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {familyGoals.map(goal => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onSelect={() => setSelectedGoal(goal)}
                        onPause={() => handlePause(goal.id)}
                        onResume={() => handleResume(goal.id)}
                        onArchive={() => handleArchive(goal.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Goals Section */}
              {individualGoals.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <User className="h-5 w-5" />
                    Individual Goals
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {individualGoals.map(goal => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onSelect={() => setSelectedGoal(goal)}
                        onPause={() => handlePause(goal.id)}
                        onResume={() => handleResume(goal.id)}
                        onArchive={() => handleArchive(goal.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GoalDetailDialog
        goal={selectedGoal}
        open={!!selectedGoal}
        onOpenChange={(open) => !open && setSelectedGoal(null)}
      />

      <CreateGoalDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        familyMembers={familyMembers}
        rewards={rewards}
      />
    </div>
  );
}
