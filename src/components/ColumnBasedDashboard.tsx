import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getMemberColorClasses } from '@/lib/utils';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFamilyData } from '@/hooks/useFamilyData';
import { executeTaskCompletion, executeTaskUncompletion, deleteTask as deleteTaskUtil } from '@/utils/taskOperations';
import { Plus, CheckCircle, Clock, Edit, Trash2, Calendar, List, Users, Gift, Settings, Sun, Clock3, Moon, FileText } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { AddButton } from '@/components/ui/add-button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';

import { CalendarView } from '@/components/CalendarView';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { MemberDashboard } from './MemberDashboard';
import { RewardsGallery } from '@/components/rewards/RewardsGallery';
import { ChildAuthProvider } from '@/hooks/useChildAuth';
import Lists from '@/pages/Lists';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { MemberPinDialog } from '@/components/dashboard/MemberPinDialog';
import { MemberSwitchDialog } from '@/components/dashboard/MemberSwitchDialog';
import { MemberSelectorDialog } from '@/components/dashboard/MemberSelectorDialog';

const ColumnBasedDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { profile, familyMembers, tasks, loading, profileError, refetch } = useFamilyData();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMemberForTask, setSelectedMemberForTask] = useState<string | null>(null);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('columns');
  const [viewMode, setViewMode] = useState<'everyone' | 'member'>('everyone');
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string | null>(null);
  
  // Dashboard mode state  
  const [dashboardMode, setDashboardMode] = useState(false);
  
  // Load dashboard mode setting
  useEffect(() => {
    const loadDashboardMode = async () => {
      if (profile?.family_id) {
        const { data } = await supabase
          .from('household_settings')
          .select('dashboard_mode_enabled')
          .eq('family_id', profile.family_id)
          .single();
        
        if (data) {
          setDashboardMode(data.dashboard_mode_enabled || false);
        }
      }
    };
    loadDashboardMode();
  }, [profile?.family_id]);

  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'complete_task' | 'delete_list_item';
    taskId?: string;
    requiredMemberId?: string;
    onSuccess: () => void;
  } | null>(null);
  
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  
  const {
    activeMemberId: hookActiveMemberId,
    switchToMember,
    authenticateMemberPin,
    canPerformAction,
    isAuthenticating
  } = useDashboardAuth();

  // Update local state when hook value changes
  useEffect(() => {
    setActiveMemberId(hookActiveMemberId);
  }, [hookActiveMemberId]);

  // Handle member switching
  const handleMemberSwitch = (memberId: string | null) => {
    if (memberId === null) {
      setShowMemberSelector(true);
    } else {
      const member = familyMembers.find(m => m.id === memberId);
      if (member) {
        switchToMember(memberId);
        setActiveMemberId(memberId);
      }
    }
  };

  // Handle tab changes - clear member selection when switching to tab view
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedMemberFilter(null);
    setViewMode('everyone');
  };

  // Handle member selection for filtering
  const handleMemberSelect = (memberId: string | null) => {
    setSelectedMemberFilter(memberId);
    if (memberId === null) {
      setViewMode('everyone');
    } else {
      setViewMode('member');
    }
  };

  // Memoized task groups for performance
  const taskGroups = useMemo(() => {
    const groups = new Set(tasks.map(task => task.task_group || 'general'));
    return Array.from(groups).sort();
  }, [tasks]);

  // Memoized filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (selectedTaskGroup && task.task_group !== selectedTaskGroup) return false;
      if (selectedMemberFilter) {
        const assignees = task.assignees?.map(a => a.profile_id) || 
                         (task.assigned_to ? [task.assigned_to] : []);
        return assignees.includes(selectedMemberFilter);
      }
      return true;
    });
  }, [tasks, selectedTaskGroup, selectedMemberFilter]);

  const completeTask = async (task: Task) => {
    if (!profile) return;
    
    try {
      // Dashboard Mode: Check member identity and PIN requirements
      if (dashboardMode) {
        // Get all assignees for this task
        const assignees = task.assignees?.map(a => a.profile) || 
                         (task.assigned_profile ? [task.assigned_profile] : []);
        
        // Check if active member is one of the assignees (for team tasks)
        if (assignees.length > 0 && activeMemberId) {
          const isAssignedMember = assignees.some(assignee => assignee.id === activeMemberId);
          
          if (!isAssignedMember) {
            // Show switch dialog to select an assigned member
            setPendingAction({
              type: 'complete_task',
              taskId: task.id,
              requiredMemberId: assignees[0].id,
              onSuccess: () => handleTaskCompletion(task)
            });
            setSwitchDialogOpen(true);
            return;
          }
          
          // For team tasks, only allow completion when viewing the acting member's own column
          if (selectedMemberFilter && selectedMemberFilter !== activeMemberId) {
            toast({
              title: 'Cannot Complete Task',
              description: 'You can only complete tasks from your own task column.',
              variant: 'destructive'
            });
            return;
          }
        }
        
        // Check PIN requirements for the active member
        const memberToCheck = activeMemberId;
        if (memberToCheck) {
          const { canProceed, needsPin } = await canPerformAction(memberToCheck, 'task_completion');
          
          if (needsPin) {
            // Show PIN dialog
            setPendingAction({
              type: 'complete_task',
              taskId: task.id,
              requiredMemberId: memberToCheck,
              onSuccess: () => handleTaskCompletion(task)
            });
            setPinDialogOpen(true);
            return;
          }
          
          if (!canProceed) {
            toast({
              title: 'Cannot Complete Task',
              description: 'Permission denied for this action.',
              variant: 'destructive'
            });
            return;
          }
        }
      }
      
      // Regular mode or dashboard mode with permissions granted
      await handleTaskCompletion(task);
    } catch (error) {
      console.error('Error in completeTask:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  };

  const handleTaskCompletion = async (task: Task) => {
    if (!profile) return;
    
    const completerId = dashboardMode && activeMemberId ? activeMemberId : profile.id;
    const completerProfile = familyMembers.find(m => m.id === completerId) || profile;
    
    const result = await executeTaskCompletion({
      task,
      completerId,
      completerProfile,
      familyMembers
    });
    
    if (result.success) {
      toast({
        title: 'Task Completed!',
        description: result.message,
      });
      refetch();
    } else {
      toast({
        title: 'Cannot Complete Task',
        description: result.message,
        variant: 'destructive'
      });
    }
  };

  const uncompleteTask = async (task: Task) => {
    if (!profile || !task.task_completions || task.task_completions.length === 0) return;
    
    const completerId = dashboardMode && activeMemberId ? activeMemberId : profile.id;
    
    const result = await executeTaskUncompletion({
      task,
      completerId,
      familyMembers
    });
    
    if (result.success) {
      toast({
        title: 'Task Uncompleted',
        description: result.message,
      });
      refetch();
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;

    const result = await deleteTaskUtil(deletingTask.id);
    
    if (result.success) {
      toast({
        title: 'Task Deleted',
        description: result.message,
      });
      refetch();
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive'
      });
    }
    
    setDeletingTask(null);
  };

  const handleTaskToggle = (task: Task) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    if (isCompleted) {
      uncompleteTask(task);
    } else {
      completeTask(task);
    }
  };

  // Drag and drop handler - simplified
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !profile) return;
    
    const { source, destination } = result;
    const taskId = result.draggableId;
    
    // Handle task reordering or moving between columns
    try {
      await supabase
        .from('tasks')
        .update({ 
          task_group: destination.droppableId 
        })
        .eq('id', taskId);
        
      refetch();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background w-full">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background w-full">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-destructive mb-2">Profile Error</h1>
          <p className="text-muted-foreground">{profileError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
            variant="outline"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // Dialog handlers
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setIsAddDialogOpen(false);
      setSelectedDate(null);
      setSelectedMemberForTask(null);
    }
  };

  const handleTaskCreateClick = () => {
    setSelectedDate(null);
    setSelectedMemberForTask(null);
    setIsAddDialogOpen(true);
  };

  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-background w-full">
        <NavigationHeader 
          familyMembers={familyMembers}
          selectedMember={selectedMemberFilter}
          onMemberSelect={handleMemberSelect}
          onSettingsClick={() => {}}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeMemberId={activeMemberId}
          onMemberSwitch={handleMemberSwitch}
          dashboardMode={dashboardMode}
          viewMode={viewMode}
        />

        <div className="container mx-auto p-4 space-y-6">
          {dashboardMode && viewMode === 'member' && selectedMemberFilter ? (
            (() => {
              const member = familyMembers.find(m => m.id === selectedMemberFilter);
              if (!member) return null;
              
              return (
                <MemberDashboard
                  member={member}
                  tasks={filteredTasks}
                  familyMembers={familyMembers}
                  profile={profile}
                  onTaskUpdated={refetch}
                  onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                  onTaskComplete={completeTask}
                  activeMemberId={activeMemberId}
                  dashboardMode="member"
                />
              );
            })()
          ) : (
            <div className="space-y-6">
              {activeTab === 'columns' && (
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Family Tasks</h1>
                    <AddButton onClick={handleTaskCreateClick} />
                  </div>
                  
                  {/* Task columns would go here - simplified for cleanup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {familyMembers.map(member => (
                      <Card key={member.id} className="p-4">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <UserAvatar name={member.display_name} color={member.color} size="sm" />
                            {member.display_name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {filteredTasks
                              .filter(task => 
                                task.assigned_to === member.id || 
                                task.assignees?.some(a => a.profile_id === member.id)
                              )
                              .map(task => (
                                <EnhancedTaskItem
                                  key={task.id}
                                  task={task}
                                  allTasks={filteredTasks}
                                  familyMembers={familyMembers}
                                  onToggle={() => handleTaskToggle(task)}
                                  onEdit={profile.role === 'parent' ? () => setEditingTask(task) : undefined}
                                  onDelete={profile.role === 'parent' ? () => setDeletingTask(task) : undefined}
                                  showActions={true}
                                />
                              ))
                            }
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  tasks={filteredTasks}
                  familyMembers={familyMembers}
                  profile={profile}
                  onTaskUpdated={refetch}
                  onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
                  familyId={profile.family_id}
                  dashboardMode={dashboardMode}
                  activeMemberId={activeMemberId}
                  onTaskComplete={completeTask}
                />
              )}

              {activeTab === 'lists' && (
                <Lists />
              )}

              {activeTab === 'rewards' && (
                <RewardsGallery />
              )}
            </div>
          )}
        </div>

        {/* Dialogs */}
        {isAddDialogOpen && (
          <AddTaskDialog
            open={isAddDialogOpen}
            onOpenChange={handleDialogClose}
            familyMembers={familyMembers}
            familyId={profile.family_id}
            profileId={profile.id}
            onTaskCreated={refetch}
            selectedDate={selectedDate}
            preselectedMemberId={selectedMemberForTask}
            preselectedTaskGroup={selectedTaskGroup}
          />
        )}

        {editingTask && (
          <EditTaskDialog
            open={!!editingTask}
            onOpenChange={(open) => !open && setEditingTask(null)}
            task={editingTask}
            familyMembers={familyMembers}
            familyId={profile.family_id}
            onTaskUpdated={refetch}
          />
        )}

        <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* PIN and member switch dialogs */}
        <MemberPinDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          member={familyMembers.find(m => m.id === (pendingAction?.requiredMemberId || '')) || familyMembers[0]}
          onSuccess={() => {
            setPinDialogOpen(false);
            if (pendingAction?.onSuccess) {
              pendingAction.onSuccess();
            }
            setPendingAction(null);
          }}
          onAuthenticate={async (pin: string) => {
            const memberId = pendingAction?.requiredMemberId || '';
            return await authenticateMemberPin(memberId, pin);
          }}
          isAuthenticating={isAuthenticating}
          action="complete task"
        />

        <MemberSwitchDialog
          open={switchDialogOpen}
          onOpenChange={setSwitchDialogOpen}
          members={familyMembers}
          currentMemberId={activeMemberId}
          requiredMemberId={pendingAction?.requiredMemberId || ''}
          onSwitch={(memberId, member) => {
            setSwitchDialogOpen(false);
            if (memberId && pendingAction?.onSuccess) {
              handleMemberSwitch(memberId);
              pendingAction.onSuccess();
            }
            setPendingAction(null);
          }}
          action="complete task"
        />

        <MemberSelectorDialog
          open={showMemberSelector}
          onOpenChange={setShowMemberSelector}
          members={familyMembers}
          currentMemberId={activeMemberId}
          onSelect={(memberId, member) => {
            setShowMemberSelector(false);
            if (memberId) {
              handleMemberSwitch(memberId);
            }
          }}
        />
      </div>
    </ChildAuthProvider>
  );
};

export default ColumnBasedDashboard;