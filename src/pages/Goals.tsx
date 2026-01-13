import { useState } from 'react';
import { Plus, Target, Users, Filter } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { Button } from '@/components/ui/button';
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
import type { Goal, GoalStatus } from '@/types/goal';

export default function Goals() {
  const { profile, familyMembers } = useAuth();
  const { goals, loading, pauseGoal, resumeGoal, archiveGoal, getMyGoals, getFamilyGoals } = useGoals();
  const { rewards } = useRewards();
  const { hasModule } = useModuleAccess(profile?.family_id);
  
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active');
  const [activeTab, setActiveTab] = useState('my');

  // Check module access
  if (!hasModule('goals')) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader 
          familyMembers={familyMembers}
          selectedMember={null}
          onMemberSelect={() => {}}
          viewMode="family"
          onViewModeChange={() => {}}
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

  const myGoals = profile?.id ? getMyGoals(profile.id) : [];
  const familyGoalsList = getFamilyGoals();

  const filterByStatus = (goalsList: Goal[]) => {
    if (statusFilter === 'all') return goalsList;
    return goalsList.filter(g => g.status === statusFilter);
  };

  const filteredMyGoals = filterByStatus(myGoals);
  const filteredFamilyGoals = filterByStatus(familyGoalsList);

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader 
        familyMembers={familyMembers}
        selectedMember={null}
        onMemberSelect={() => {}}
        viewMode="family"
        onViewModeChange={() => {}}
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
        
        <div className="flex items-center justify-between mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList>
              <TabsTrigger value="my" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
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
              {filteredMyGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium text-lg mb-1">No goals yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Set a personal goal to track your progress
                  </p>
                  <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first goal
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredMyGoals.map((goal) => (
                    <GoalCard 
                      key={goal.id}
                      goal={goal}
                      onSelect={setSelectedGoal}
                      onPause={pauseGoal}
                      onResume={resumeGoal}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="family" className="mt-0">
              {filteredFamilyGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <h3 className="font-medium text-lg mb-1">No family goals yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create a goal the whole family can work toward together
                  </p>
                  <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create a family goal
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredFamilyGoals.map((goal) => (
                    <GoalCard 
                      key={goal.id}
                      goal={goal}
                      onSelect={setSelectedGoal}
                      onPause={pauseGoal}
                      onResume={resumeGoal}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
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
