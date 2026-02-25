import { useState, useCallback, useEffect } from 'react';
import { Plus, Target, Filter, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/typography';
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
import { useTaskCompletion } from '@/hooks/useTaskCompletion';
import { useGoalLinkedTasks } from '@/hooks/useGoalLinkedTasks';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Goal, GoalStatus, GoalLinkedTask } from '@/types/goal';

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
  const queryClient = useQueryClient();
  const { 
    goals, 
    loading, 
    pauseGoal, 
    resumeGoal, 
    archiveGoal, 
    deleteGoal,
    profileId, 
    familyId,
    reorderGoals,
    fetchGoals
  } = useGoals();
  const { rewards } = useRewards();
  const { hasModule } = useModuleAccess(familyId);
  
  // Get current user profile for task completion
  const currentUserProfile = familyMembers.find(m => m.id === profileId) || null;
  
  // Task completion hook
  const { completeTask, uncompleteTask, isCompleting } = useTaskCompletion({
    currentUserProfile: currentUserProfile as any,
    activeMemberId: selectedMemberId,
    isDashboardMode: false
  });
  
  // Get all linked tasks from all goals for task lookup
  const allLinkedTasks = goals.flatMap(g => g.linked_tasks || []);
  const { tasksMap, refetch: refetchLinkedTasks } = useGoalLinkedTasks(allLinkedTasks);
  
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active');
  const [orderedGoals, setOrderedGoals] = useState<Goal[]>([]);

  // Reset ordered goals when goals list changes (new goal added, edited, etc.)
  // This ensures new goals appear immediately without manual refresh
  useEffect(() => {
    setOrderedGoals([]);

    // Keep dialogs in sync with the freshest goal data
    setSelectedGoal((prev) => (prev ? goals.find((g) => g.id === prev.id) ?? null : null));
    setEditingGoal((prev) => (prev ? goals.find((g) => g.id === prev.id) ?? null : null));
  }, [goals]);
  
  // Handle task completion/uncomplete from goals — with optimistic UI update
  const handleTaskToggle = async (linkedTask: GoalLinkedTask, passedTask?: any) => {

    // If task was passed directly, use it (more reliable for series tasks)
    let task = passedTask;
    
    if (!task) {
      // Fall back to looking up in tasksMap
      const matchingEntries = Object.entries(tasksMap).filter(([key]) => 
        key === linkedTask.id || key.startsWith(`${linkedTask.id}-`)
      );
      
      const taskEntries = matchingEntries.length > 0 
        ? matchingEntries 
        : tasksMap[linkedTask.id] ? [[linkedTask.id, tasksMap[linkedTask.id]] as const] : [];
      
      if (taskEntries.length === 0) {
        return;
      }
      
      task = taskEntries[0][1];
    }
    
    // Check if the task has any completions in the current data
    const memberId = (task as any)._member_id || task.assignees?.[0]?.profile_id;
    const completerId = memberId || selectedMemberId || profileId;
    const hasCompletion = task.task_completions?.some(
      (c: any) => c.completed_by === completerId
    ) || (task.task_completions && task.task_completions.length > 0 && !completerId);
    
    // --- Optimistic update: snapshot current React Query caches and patch them ---
    // We snapshot all three query caches that feed into tasksMap so we can roll back on error.
    const taskIdsKey = allLinkedTasks.filter(lt => lt.task_id).map(lt => lt.task_id!);
    const seriesIdsKey = allLinkedTasks.filter(lt => lt.task_series_id).map(lt => lt.task_series_id!);
    const rotatingIdsKey = allLinkedTasks.filter(lt => lt.rotating_task_id).map(lt => lt.rotating_task_id!);

    const regularKey = ['goal-linked-tasks', taskIdsKey];
    const seriesKey = ['goal-linked-series', seriesIdsKey];
    const rotatingKey = ['goal-linked-rotating', rotatingIdsKey];

    // Snapshot previous data for rollback
    const prevRegular = queryClient.getQueryData(regularKey);
    const prevSeries = queryClient.getQueryData(seriesKey);
    const prevRotating = queryClient.getQueryData(rotatingKey);

    // Helper: patch task_completions in a list of tasks
    const patchTasks = (tasks: any[] | undefined) => {
      if (!tasks) return tasks;
      return tasks.map((t: any) => {
        // Match by id (handles composite IDs like "taskId-memberId")
        const isMatch = t.id === task.id || 
          (task.series_id && t.series_id === task.series_id && (t as any)._member_id === memberId);
        if (!isMatch) return t;
        
        if (hasCompletion) {
          // Removing completion
          return {
            ...t,
            task_completions: (t.task_completions || []).filter(
              (c: any) => c.completed_by !== completerId
            ),
          };
        } else {
          // Adding completion
          return {
            ...t,
            task_completions: [
              ...(t.task_completions || []),
              {
                id: `optimistic-${Date.now()}`,
                task_id: t.id,
                completed_by: completerId,
                completed_at: new Date().toISOString(),
              },
            ],
          };
        }
      });
    };

    // Apply optimistic patches to all three caches
    queryClient.setQueryData(regularKey, (old: any) => patchTasks(old));
    queryClient.setQueryData(seriesKey, (old: any) => patchTasks(old));
    queryClient.setQueryData(rotatingKey, (old: any) => patchTasks(old));

    // Also optimistically patch consistency/target completion caches
    if (!hasCompletion && completerId) {
      // For consistency goals: add today's date to the member's completions
      queryClient.setQueriesData({ queryKey: ['consistency-completions'] }, (old: any) => {
        if (!old) return old;
        const today = new Date().toISOString().split('T')[0];
        const updated = { ...old };
        if (updated.completionsByMember) {
          const memberDates = [...(updated.completionsByMember[completerId] || [])];
          if (!memberDates.includes(today)) memberDates.push(today);
          updated.completionsByMember = { ...updated.completionsByMember, [completerId]: memberDates };
        }
        if (updated.allCompletedDates) {
          const allDates = [...updated.allCompletedDates];
          if (!allDates.includes(today)) allDates.push(today);
          updated.allCompletedDates = allDates;
        }
        return updated;
      });
      
      // For target goals: increment the member's count
      queryClient.setQueriesData({ queryKey: ['target-completions'] }, (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        if (updated.completionsByMember) {
          updated.completionsByMember = { 
            ...updated.completionsByMember, 
            [completerId]: (updated.completionsByMember[completerId] || 0) + 1 
          };
        }
        if (typeof updated.totalCompletions === 'number') {
          updated.totalCompletions = updated.totalCompletions + 1;
        }
        return updated;
      });
    }

    // Callback: dispatch task-updated for background reconciliation
    const onComplete = () => {
      window.dispatchEvent(new CustomEvent('task-updated'));
    };
    
    // Rollback function if the DB call fails
    const rollback = () => {
      queryClient.setQueryData(regularKey, prevRegular);
      queryClient.setQueryData(seriesKey, prevSeries);
      queryClient.setQueryData(rotatingKey, prevRotating);
      queryClient.invalidateQueries({ queryKey: ['consistency-completions'] });
      queryClient.invalidateQueries({ queryKey: ['target-completions'] });
    };
    
    let success: boolean;

    if (hasCompletion) {
      success = await uncompleteTask(task, onComplete, memberId);
    } else {
      success = await completeTask(task, onComplete, memberId);
    }
    
    if (!success) {
      rollback();
    }
  };

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
      const success = await deleteGoal(goalId);
      if (success) {
        // Close detail dialog if open
        if (selectedGoal?.id === goalId) {
          setSelectedGoal(null);
        }
        toast.success('Goal deleted');
      }
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-gap"
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
                          onCompleteTask={handleTaskToggle}
                          preloadedTasksMap={tasksMap}
                          preloadedFamilyMembers={familyMembers as any[]}
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
    <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between section-spacing">
          <PageHeading>Goals</PageHeading>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Goal</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-gap">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          renderGoalsList(displayGoals)
        )}
      
      <GoalDetailDialog
        goal={selectedGoal}
        open={!!selectedGoal}
        onOpenChange={(open) => !open && setSelectedGoal(null)}
        onEdit={handleEdit}
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
