import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getMemberColorClasses } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Edit, Trash2, Calendar, List, Users, Gift, Settings } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { AddButton } from '@/components/ui/add-button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { RecurringSeriesDialog } from '@/components/RecurringSeriesDialog';
import { CalendarView } from '@/components/CalendarView';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
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
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { useRotatingTasks } from '@/hooks/useRotatingTasks';
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

const ColumnBasedDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [viewingSeries, setViewingSeries] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMemberForTask, setSelectedMemberForTask] = useState<string | null>(null);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('columns');
  const { taskSeries } = useRecurringTasks(profile?.family_id);
  const { rotatingTasks, refreshRotatingTasks } = useRotatingTasks(profile?.family_id);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch current user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        return;
      }

      setProfile(profileData);

      // Fetch family members ordered by sort_order for consistent column positioning
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (membersError) {
        console.error('Members error:', membersError);
      } else {
        setFamilyMembers(membersData || []);
      }

      // Fetch family tasks with completion status
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          points,
          is_repeating,
          due_date,
          assigned_to,
          created_by,
          recurring_frequency,
          recurring_interval,
          recurring_days_of_week,
          recurring_end_date,
          series_id,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
          assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', profileData.family_id);

      if (tasksError) {
        console.error('Tasks error:', tasksError);
      } else {
        setTasks(tasksData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (task: Task) => {
    if (!profile) return;
    
    try {
      // Check if this is a rotating task
      if (task.id.startsWith('rotating-')) {
        const rotatingTaskId = task.id.replace('rotating-', '');
        const rotatingTask = rotatingTasks.find(rt => rt.id === rotatingTaskId);
        
        if (rotatingTask) {
          // Advance to next member in rotation
          const nextIndex = (rotatingTask.current_member_index + 1) % rotatingTask.member_order.length;
          await supabase
            .from('rotating_tasks')
            .update({ current_member_index: nextIndex })
            .eq('id', rotatingTaskId);

          // Award points to the current member
          const currentMemberId = rotatingTask.member_order[rotatingTask.current_member_index];
          const currentMember = familyMembers.find(m => m.id === currentMemberId);
          
          if (currentMember) {
            await supabase
              .from('profiles')
              .update({
                total_points: currentMember.total_points + task.points
              })
              .eq('id', currentMemberId);

            toast({
              title: 'Rotating Task Completed!',
              description: `${currentMember.display_name} earned ${task.points} points! Next: ${familyMembers.find(m => m.id === rotatingTask.member_order[nextIndex])?.display_name}`,
            });
          }

          // Refresh both user data and rotating tasks to reflect the change immediately
          await Promise.all([fetchUserData(), refreshRotatingTasks()]);
          return;
        }
      }

      // Regular task completion logic
      // Get all assignees for this task (including both old and new format)
      const assignees = task.assignees?.map(a => a.profile) || 
                       (task.assigned_profile ? [task.assigned_profile] : []);
      
      // If no specific assignees, anyone can complete it and only they get points
      const pointRecipients = assignees.length > 0 ? assignees : [profile];
      
      // Create task completion record
      const { error } = await supabase
        .from('task_completions')
        .insert({
          task_id: task.id,
          completed_by: profile.id,
          points_earned: task.points
        });

      if (error) {
        throw error;
      }

      // Award points to all assignees (or just the completer if no assignees)
      const pointUpdates = pointRecipients.map(async (recipient) => {
        const currentProfile = familyMembers.find(m => m.id === recipient.id);
        if (currentProfile) {
          return supabase
            .from('profiles')
            .update({
              total_points: currentProfile.total_points + task.points
            })
            .eq('id', recipient.id);
        }
      });

      const updateResults = await Promise.all(pointUpdates.filter(Boolean));
      
      // Check for errors in point updates
      const updateErrors = updateResults.filter(result => result?.error);
      if (updateErrors.length > 0) {
        throw new Error('Failed to update some points');
      }

      // Create toast message based on point distribution
      let toastMessage;
      if (pointRecipients.length === 1 && pointRecipients[0].id === profile.id) {
        toastMessage = `You earned ${task.points} points!`;
      } else if (pointRecipients.length === 1) {
        toastMessage = `${pointRecipients[0].display_name} earned ${task.points} points!`;
      } else {
        const names = pointRecipients.map(p => p.display_name).join(', ');
        toastMessage = `${task.points} points awarded to: ${names}`;
      }

      toast({
        title: 'Task Completed!',
        description: toastMessage,
      });

      fetchUserData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive'
      });
    }
  };

  const uncompleteTask = async (task: Task) => {
    if (!profile || !task.task_completions || task.task_completions.length === 0) return;
    
    try {
      // Find the completion record by the current user
      const userCompletion = task.task_completions.find(completion => completion.completed_by === profile.id);
      
      if (!userCompletion) {
        return;
      }

      // Get all assignees who received points
      const assignees = task.assignees?.map(a => a.profile) || 
                       (task.assigned_profile ? [task.assigned_profile] : [profile]);

      // Remove the specific task completion record
      const { error } = await supabase
        .from('task_completions')
        .delete()
        .eq('id', userCompletion.id);

      if (error) {
        throw error;
      }

      // Remove points from all assignees who received them
      const pointUpdates = assignees.map(async (recipient) => {
        const currentProfile = familyMembers.find(m => m.id === recipient.id);
        if (currentProfile) {
          return supabase
            .from('profiles')
            .update({
              total_points: currentProfile.total_points - task.points
            })
            .eq('id', recipient.id);
        }
      });

      const updateResults = await Promise.all(pointUpdates.filter(Boolean));
      
      // Check for errors in point updates
      const updateErrors = updateResults.filter(result => result?.error);
      if (updateErrors.length > 0) {
        throw new Error('Failed to update some points');
      }

      toast({
        title: 'Task Uncompleted',
        description: `${task.points} points removed`,
      });

      fetchUserData();
    } catch (error) {
      console.error('Error uncompleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to uncomplete task',
        variant: 'destructive'
      });
    }
  };

  const handleTaskToggle = (task: Task) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    if (isCompleted) {
      uncompleteTask(task);
    } else {
      completeTask(task);
    }
  };

  const deleteTask = async () => {
    if (!deletingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', deletingTask.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Task Deleted',
        description: 'Task has been removed successfully',
      });

      setDeletingTask(null);
      fetchUserData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  };

  // Handle drag end for task assignment
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = draggableId;
    const newAssigneeId = destination.droppableId === 'unassigned' ? null : destination.droppableId;

    try {
      // First, remove existing task assignees
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);

      if (deleteError) throw deleteError;

      // Update the main task assignment for backward compatibility
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assigned_to: newAssigneeId })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // If assigning to a specific member, create new task_assignee record
      if (newAssigneeId) {
        const { error: insertError } = await supabase
          .from('task_assignees')
          .insert({
            task_id: taskId,
            profile_id: newAssigneeId,
            assigned_by: profile.id
          });

        if (insertError) throw insertError;

        const assignedMember = familyMembers.find(m => m.id === newAssigneeId);
        toast({
          title: 'Task reassigned',
          description: `Task assigned to ${assignedMember?.display_name || 'member'}`,
        });
      } else {
        toast({
          title: 'Task unassigned',
          description: 'Task moved to unassigned pool',
        });
      }

      // Refresh data to show updated assignments
      fetchUserData();
    } catch (error) {
      console.error('Error updating task assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task assignment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get tasks organized by family member with filtering
  const getTasksByMember = () => {
    const tasksByMember = new Map<string, Task[]>();
    
    // Initialize with all family members in the same order as familyMembers array
    familyMembers.forEach(member => {
      tasksByMember.set(member.id, []);
    });
    
    // Add unassigned tasks category
    tasksByMember.set('unassigned', []);
    
    // Add regular tasks
    tasks.forEach(task => {
      if (task.assignees && task.assignees.length > 0) {
        // Task has multiple assignees - add to each
        task.assignees.forEach(assignee => {
          const memberTasks = tasksByMember.get(assignee.profile_id) || [];
          memberTasks.push(task);
          tasksByMember.set(assignee.profile_id, memberTasks);
        });
      } else if (task.assigned_to) {
        // Single assignee (old format)
        const memberTasks = tasksByMember.get(task.assigned_to) || [];
        memberTasks.push(task);
        tasksByMember.set(task.assigned_to, memberTasks);
      } else {
        // Unassigned task
        const unassignedTasks = tasksByMember.get('unassigned') || [];
        unassignedTasks.push(task);
        tasksByMember.set('unassigned', unassignedTasks);
      }
    });

    // Add rotating tasks for the current member
    rotatingTasks.forEach(rotatingTask => {
      if (!rotatingTask.is_paused && rotatingTask.is_active) {
        const currentMemberIndex = rotatingTask.current_member_index;
        const currentMemberId = rotatingTask.member_order[currentMemberIndex];
        
        if (currentMemberId) {
          // Create a virtual task for the rotating task
          const virtualTask: Task = {
            id: `rotating-${rotatingTask.id}`,
            title: `🔄 ${rotatingTask.name}`,
            description: rotatingTask.description || '',
            points: rotatingTask.points,
            assigned_to: currentMemberId,
            due_date: null,
            created_by: rotatingTask.created_by,
            is_repeating: false,
            recurring_frequency: null,
            recurring_interval: null,
            recurring_days_of_week: null,
            recurring_end_date: null,
            series_id: null,
            task_completions: [],
            assignees: []
          };

          const memberTasks = tasksByMember.get(currentMemberId) || [];
          memberTasks.push(virtualTask);
          tasksByMember.set(currentMemberId, memberTasks);
        }
      }
    });
    
    // Filter tasks by selected member if one is chosen
    if (selectedMemberFilter) {
      const filteredMap = new Map<string, Task[]>();
      filteredMap.set(selectedMemberFilter, tasksByMember.get(selectedMemberFilter) || []);
      return filteredMap;
    }
    
    return tasksByMember;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAddTaskForMember = (memberId: string) => {
    setSelectedMemberForTask(memberId);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setSelectedMemberForTask(null);
  };

  const handleSettingsClick = () => {
    // Navigate to admin dashboard
    window.location.href = '/admin';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg">Loading your family dashboard...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold">Profile Not Found</div>
              <p className="text-muted-foreground mt-2">There was an issue loading your profile.</p>
              <Button onClick={() => signOut()} className="mt-4">Sign Out</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tasksByMember = getTasksByMember();

  return (
    <div className="min-h-screen bg-background w-full">
      {/* Navigation Header */}
      <NavigationHeader
        familyMembers={familyMembers}
        selectedMember={selectedMemberFilter}
        onMemberSelect={setSelectedMemberFilter}
        onSettingsClick={handleSettingsClick}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="w-full px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Hidden tab list since navigation is in header */}
          <TabsList className="hidden">
            <TabsTrigger value="columns">Tasks</TabsTrigger>
            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="mt-4 sm:mt-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="w-full overflow-x-auto touch-pan-x">
                <div className="flex gap-3 sm:gap-4 pb-4" style={{ minWidth: 'fit-content' }}>
                   {/* Family member columns - filtered if a member is selected */}
                   {familyMembers
                     .filter(member => !selectedMemberFilter || member.id === selectedMemberFilter)
                     .map(member => {
                     const memberTasks = tasksByMember.get(member.id) || [];
                     const completedTasks = memberTasks.filter(task => 
                       task.task_completions && task.task_completions.length > 0
                     );
                     const pendingTasks = memberTasks.filter(task => 
                       !task.task_completions || task.task_completions.length === 0
                     );

                     return (
                       <Card key={member.id} className={cn(
                         "flex-shrink-0 w-72 sm:w-80 h-fit border-2",
                         getMemberColorClasses(member.color).border,
                         getMemberColorClasses(member.color).bgSoft
                       )}>
                         <CardHeader className={cn(
                           "pb-3 border-b",
                           getMemberColorClasses(member.color).border
                         )}>
                           <div className="flex items-center gap-3">
                              <UserAvatar
                                name={member.display_name}
                                color={member.color}
                                size="md"
                                className="sm:h-10 sm:w-10"
                              />
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-base sm:text-lg truncate">{member.display_name}</CardTitle>
                                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                  <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-xs">
                                    {member.role}
                                  </Badge>
                                  <span className="truncate">{member.total_points} pts</span>
                                </div>
                             </div>
                           </div>
                            <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                              <span>{pendingTasks.length} pending</span>
                              <span>{completedTasks.length} completed</span>
                            </div>
                         </CardHeader>

                         <Droppable droppableId={member.id}>
                           {(provided, snapshot) => (
                             <CardContent 
                               className={cn(
                                 "space-y-3 transition-colors",
                                 snapshot.isDraggingOver && "bg-accent/50"
                               )}
                               ref={provided.innerRef}
                               {...provided.droppableProps}
                             >
                                <div className="space-y-2 sm:space-y-3 mb-4 min-h-[100px]">
                                  {memberTasks.length === 0 ? (
                                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                      <Clock className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                                      <p className="text-xs sm:text-sm px-2">
                                        {snapshot.isDraggingOver ? 'Drop task here to assign' : 'No tasks assigned'}
                                      </p>
                                   </div>
                                 ) : (
                                   memberTasks.map((task, index) => (
                                     <Draggable key={task.id} draggableId={task.id} index={index}>
                                       {(provided, snapshot) => (
                                         <div
                                           ref={provided.innerRef}
                                           {...provided.draggableProps}
                                           {...provided.dragHandleProps}
                                           className={cn(
                                             snapshot.isDragging && "shadow-lg rotate-1 scale-105 z-50"
                                           )}
                                         >
                                           <EnhancedTaskItem
                                             task={task}
                                             allTasks={tasks}
                                             familyMembers={familyMembers}
                                             onToggle={handleTaskToggle}
                                             onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                             onDelete={profile.role === 'parent' ? setDeletingTask : undefined}
                                             showActions={profile.role === 'parent' && !snapshot.isDragging}
                                           />
                                         </div>
                                       )}
                                     </Draggable>
                                   ))
                                 )}
                                 {provided.placeholder}
                               </div>
                               
                               {/* Add Task Button */}
                               {profile.role === 'parent' && (
                                  <AddButton
                                    className={cn(
                                      "w-full",
                                      getMemberColorClasses(member.color).border,
                                      getMemberColorClasses(member.color).text
                                    )}
                                    text="Add Task"
                                    onClick={() => handleAddTaskForMember(member.id)}
                                  />
                               )}
                             </CardContent>
                           )}
                         </Droppable>
                       </Card>
                     );
                   })}

                   {/* Unassigned tasks column - only show if no member filter or if unassigned has tasks */}
                   {!selectedMemberFilter && (tasksByMember.get('unassigned')?.length > 0 || profile.role === 'parent') && (
                     <Card className="flex-shrink-0 w-72 sm:w-80 h-fit">
                      <CardHeader className="pb-3">
                         <div className="flex items-center gap-2 sm:gap-3">
                           <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                             <AvatarFallback className="bg-muted text-muted-foreground text-xs sm:text-sm">
                               ?
                             </AvatarFallback>
                           </Avatar>
                           <div className="min-w-0 flex-1">
                             <CardTitle className="text-base sm:text-lg">Unassigned</CardTitle>
                             <CardDescription className="text-xs sm:text-sm">Drag to assign to members</CardDescription>
                           </div>
                         </div>
                      </CardHeader>
                      
                      <Droppable droppableId="unassigned">
                        {(provided, snapshot) => (
                          <CardContent 
                            className={cn(
                              "space-y-3 transition-colors",
                              snapshot.isDraggingOver && "bg-accent/50"
                            )}
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                             <div className="space-y-2 sm:space-y-3 mb-4 min-h-[100px]">
                               {tasksByMember.get('unassigned')?.length === 0 ? (
                                 <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                   <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                                   <p className="text-xs sm:text-sm px-2">
                                     {snapshot.isDraggingOver ? 'Drop here to unassign' : 'No unassigned tasks'}
                                   </p>
                                 </div>
                              ) : (
                                tasksByMember.get('unassigned')?.map((task, index) => (
                                  <Draggable key={task.id} draggableId={task.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={cn(
                                          snapshot.isDragging && "shadow-lg rotate-1 scale-105 z-50"
                                        )}
                                      >
                                        <EnhancedTaskItem
                                          task={task}
                                          allTasks={tasks}
                                          familyMembers={familyMembers}
                                          onToggle={handleTaskToggle}
                                          onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                          onDelete={profile.role === 'parent' ? setDeletingTask : undefined}
                                          showActions={profile.role === 'parent' && !snapshot.isDragging}
                                        />
                                      </div>
                                    )}
                                  </Draggable>
                                )) || []
                              )}
                              {provided.placeholder}
                            </div>
                            
                             {/* Add Task Button */}
                             {profile.role === 'parent' && (
                               <div className="pt-3 border-t">
                                 <AddButton
                                   className="w-full"
                                   text="Add Task"
                                   onClick={() => setIsAddDialogOpen(true)}
                                 />
                               </div>
                             )}
                          </CardContent>
                        )}
                      </Droppable>
                    </Card>
                  )}
                </div>
              </div>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="lists" className="mt-4 sm:mt-6">
            <div className="w-full">
              <Lists />
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4 sm:mt-6">
            <div className="w-full">
              <CalendarView
                tasks={selectedMemberFilter ? tasks.filter(task => 
                  task.assigned_to === selectedMemberFilter || 
                  task.assignees?.some(a => a.profile_id === selectedMemberFilter)
                ) : tasks}
                familyMembers={selectedMemberFilter ? familyMembers.filter(m => m.id === selectedMemberFilter) : familyMembers}
                onTaskUpdated={fetchUserData}
                onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="mt-4 sm:mt-6">
            <div className="w-full">
              <ChildAuthProvider>
                <RewardsGallery selectedMemberId={selectedMemberFilter} />
              </ChildAuthProvider>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {isAddDialogOpen && (
        <AddTaskDialog
          open={isAddDialogOpen}
          onOpenChange={handleDialogClose}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          profileId={profile.id}
          onTaskCreated={fetchUserData}
          selectedDate={selectedDate}
          preselectedMemberId={selectedMemberForTask}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
          familyMembers={familyMembers}
          onTaskUpdated={fetchUserData}
        />
      )}

      {viewingSeries && (
        <RecurringSeriesDialog
          open={!!viewingSeries}
          onOpenChange={(open) => !open && setViewingSeries(null)}
          series={viewingSeries}
          tasks={tasks}
          familyMembers={familyMembers}
          onSeriesUpdated={fetchUserData}
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
            <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ColumnBasedDashboard;