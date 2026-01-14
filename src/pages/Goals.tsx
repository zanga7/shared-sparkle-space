import { useState, useEffect } from 'react';
import { Plus, Target, Users, User, Filter, Pause, Play, Archive } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalDetailDialog } from '@/components/goals/GoalDetailDialog';
import { CreateGoalDialog } from '@/components/goals/CreateGoalDialog';
import { useGoals } from '@/hooks/useGoals';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Goal, GoalStatus } from '@/types/goal';

interface FamilyMember {
  id: string;
  display_name: string;
  color: string;
  avatar_url?: string | null;
  total_points: number;
  role: 'parent' | 'child';
}

export default function Goals() {
  const { user } = useAuth();
  const { 
    goals, 
    loading, 
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    getMyGoals, 
    getFamilyGoals, 
    profileId, 
    familyId 
  } = useGoals();
  const { rewards } = useRewards();
  const { hasModule } = useModuleAccess(familyId);
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active');
  const [activeTab, setActiveTab] = useState('my');

  // Fetch family members
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      if (!familyId) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, color, avatar_url, total_points, role')
        .eq('family_id', familyId)
        .eq('status', 'active')
        .order('role', { ascending: false })
        .order('display_name');

      if (data) {
        setFamilyMembers(data as FamilyMember[]);
      }
    };

    fetchFamilyMembers();
  }, [familyId]);

  // Goal action handlers with toasts
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

  // Check module access
  if (!hasModule('goals')) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader 
          familyMembers={familyMembers}
          selectedMember={null}
          onMemberSelect={() => {}}
          onSettingsClick={() => {}}
          activeTab="goals"
          onTabChange={() => {}}
          viewMode="everyone"
        />
        <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
          <Target className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Goals Module</h2>
          <p className="text-muted-foreground">
            The Goals module is not enabled for your family plan.
          </p>
        </div>
      </div>
    );
  }

  // Calculate status counts for all goals
  const statusCounts = {
    active: goals.filter(g => g.status === 'active').length,
    paused: goals.filter(g => g.status === 'paused').length,
    completed: goals.filter(g => g.status === 'completed').length,
    archived: goals.filter(g => g.status === 'archived').length,
  };

  const myGoals = profileId ? getMyGoals(profileId) : [];
  const familyGoalsList = getFamilyGoals();

  const filterByStatus = (goalsList: Goal[]) => {
    if (statusFilter === 'all') return goalsList;
    return goalsList.filter(g => g.status === statusFilter);
  };

  const filteredMyGoals = filterByStatus(myGoals);
  const filteredFamilyGoals = filterByStatus(familyGoalsList);

  const renderGoalsList = (goalsList: Goal[], emptyIcon: React.ReactNode, emptyTitle: string, emptyDescription: string) => {
    if (goalsList.length === 0) {
      return (
        <div className="text-center py-12">
          {emptyIcon}
          <h3 className="font-medium text-lg mb-1">{emptyTitle}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {emptyDescription}
          </p>
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create a goal
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {goalsList.map((goal) => (
          <GoalCard 
            key={goal.id}
            goal={goal}
            onSelect={setSelectedGoal}
            onPause={() => handlePause(goal.id)}
            onResume={() => handleResume(goal.id)}
            onArchive={() => handleArchive(goal.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader 
        familyMembers={familyMembers}
        selectedMember={null}
        onMemberSelect={() => {}}
        onSettingsClick={() => {}}
        activeTab="goals"
        onTabChange={() => {}}
        viewMode="everyone"
      />
      
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Goals</h1>
            <p className="text-muted-foreground">Track progress toward meaningful outcomes</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'active' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{statusCounts.active}</div>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'paused' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('paused')}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-500">{statusCounts.paused}</div>
              <p className="text-sm text-muted-foreground">Paused</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'completed' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${statusFilter === 'archived' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('archived')}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-muted-foreground">{statusCounts.archived}</div>
              <p className="text-sm text-muted-foreground">Archived</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList>
              <TabsTrigger value="my" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                My Goals
                {filteredMyGoals.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 px-1.5 rounded">
                    {filteredMyGoals.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="family" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family Goals
                {filteredFamilyGoals.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 px-1.5 rounded">
                    {filteredFamilyGoals.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as GoalStatus | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="my" className="mt-0">
              {renderGoalsList(
                filteredMyGoals,
                <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />,
                'No personal goals',
                statusFilter === 'all' 
                  ? 'Set a personal goal to track your progress'
                  : `No ${statusFilter} personal goals`
              )}
            </TabsContent>
            
            <TabsContent value="family" className="mt-0">
              {renderGoalsList(
                filteredFamilyGoals,
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />,
                'No family goals',
                statusFilter === 'all'
                  ? 'Create a goal the whole family can work toward together'
                  : `No ${statusFilter} family goals`
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
      
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
