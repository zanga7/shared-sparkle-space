import { useState, useCallback } from 'react';
import { Plus, Target, Filter, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalDetailDialog } from '@/components/goals/GoalDetailDialog';
import { CreateGoalDialog } from '@/components/goals/CreateGoalDialog';
import { EditGoalDialog } from '@/components/goals/EditGoalDialog';
import { useGoals } from '@/hooks/useGoals';
import { useRewards } from '@/hooks/useRewards';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Goal, GoalStatus } from '@/types/goal';

interface FamilyMember {
  id: string;
  display_name: string;
  color: string;
  avatar_url?: string | null;
  total_points?: number;
  role: 'parent' | 'child';
}

interface GoalsContentProps {
  familyMembers: FamilyMember[];
  selectedMemberId?: string | null;
  viewMode?: 'everyone' | 'member';
}

export function GoalsContent({ familyMembers, selectedMemberId, viewMode = 'everyone' }: GoalsContentProps) {
  const { 
    goals, 
    loading, 
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    profileId, 
    familyId,
    reorderGoals
  } = useGoals();
  const { rewards } = useRewards();
  const { hasModule } = useModuleAccess(familyId);
  
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active');
  const [orderedGoals, setOrderedGoals] = useState<Goal[]>([]);

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

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
  };

  // Check module access
  if (!hasModule('goals')) {
    return (
      <div className="text-center py-16">
        <Target className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Goals Module</h2>
        <p className="text-muted-foreground">
          The Goals module is not enabled for your family plan.
        </p>
      </div>
    );
  }

  // Filter goals by member if in member view
  const getFilteredGoals = () => {
    let filtered = goals;
    
    // Filter by member if viewing a specific member
    if (viewMode === 'member' && selectedMemberId) {
      filtered = goals.filter(g => 
        g.assigned_to === selectedMemberId || 
        g.assignees?.some(a => a.profile_id === selectedMemberId)
      );
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }
    
    return filtered;
  };

  const filteredGoals = getFilteredGoals();

  // Handle drag and drop
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(filteredGoals);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setOrderedGoals(items);
    
    // Save new order (could persist to DB if needed)
    if (reorderGoals) {
      reorderGoals(items.map(g => g.id));
    }
  }, [filteredGoals, reorderGoals]);

  // Use ordered goals if we have them, otherwise use filtered
  const displayGoals = orderedGoals.length > 0 && orderedGoals.every(og => filteredGoals.some(fg => fg.id === og.id))
    ? orderedGoals.filter(og => filteredGoals.some(fg => fg.id === og.id))
    : filteredGoals;

  const renderGoalsList = (goalsList: Goal[]) => {
    if (goalsList.length === 0) {
      return (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium text-lg mb-1">No goals yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {statusFilter === 'all' 
              ? 'Create a goal to track your progress'
              : `No ${statusFilter} goals`}
          </p>
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create a goal
          </Button>
        </div>
      );
    }

    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="goals-list">
          {(provided) => (
            <div 
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {goalsList.map((goal, index) => (
                <Draggable key={goal.id} draggableId={goal.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-90' : ''}
                    >
                      <div className="relative group">
                        <div 
                          {...provided.dragHandleProps}
                          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded bg-background/80 shadow-sm"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <GoalCard 
                          goal={goal}
                          onSelect={setSelectedGoal}
                          onEdit={() => handleEdit(goal)}
                          onPause={() => handlePause(goal.id)}
                          onResume={() => handleResume(goal.id)}
                          onArchive={() => handleArchive(goal.id)}
                        />
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  };

  return (
    <div className="min-h-screen bg-background page-padding">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between section-spacing">
          <div>
            <h1 className="text-3xl font-bold">Goals</h1>
            <p className="text-muted-foreground">Track progress toward meaningful outcomes</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
        </div>
      
        {/* Filter */}
        <div className="flex items-center justify-end gap-2 mb-6">
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
      
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          renderGoalsList(displayGoals)
        )}
      </div>
      
      <GoalDetailDialog 
        goal={selectedGoal}
        open={!!selectedGoal}
        onOpenChange={(open) => !open && setSelectedGoal(null)}
      />
      
      <EditGoalDialog
        goal={editingGoal}
        open={!!editingGoal}
        onOpenChange={(open) => !open && setEditingGoal(null)}
        familyMembers={familyMembers}
        rewards={rewards}
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
