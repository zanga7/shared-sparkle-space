import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getMemberColorClasses } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Edit, Trash2, Calendar, List, Users, Gift, Settings, Sun, Clock3, Moon, FileText } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { AddButton } from '@/components/ui/add-button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
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
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { MemberPinDialog } from '@/components/dashboard/MemberPinDialog';
import { MemberSwitchDialog } from '@/components/dashboard/MemberSwitchDialog';
import { MemberSelectorDialog } from '@/components/dashboard/MemberSelectorDialog';

const ColumnBasedDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [currentTab, setCurrentTab] = useState('today');
  const [refreshKey, setRefreshKey] = useState(0);

  // Dashboard auth state
  const {
    isDashboardMode,
    activeMember,
    setActiveMember,
    isParent,
    showMemberSelector,
    setShowMemberSelector,
    showPinDialog,
    setShowPinDialog,
    showMemberSwitch,
    setShowMemberSwitch,
    selectedMemberForPin,
    setSelectedMemberForPin,
    handleDashboardLogout
  } = useDashboardAuth();

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        
        const { data: membersData } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_id', profileData.family_id);
          
        setFamilyMembers(membersData || []);
        fetchTasks(profileData.family_id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchTasks = async (familyId: string) => {
    setLoading(true);
    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
          assignees:task_assignees(
            id,
            profile_id,
            assigned_at,
            assigned_by,
            profile:profiles(id, display_name, role, color)
          ),
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks = tasksData?.map(task => ({
        ...task,
        completion_rule: task.completion_rule || 'everyone'
      })) || [];

      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (task: Task) => {
    try {
      const completerId = activeMember?.id || profile?.id;
      if (!completerId) return;

      // Add completion
      const { error: completionError } = await supabase
        .from('task_completions')
        .insert({
          task_id: task.id,
          completed_by: completerId,
          points_earned: task.points,
        });

      if (completionError) throw completionError;

      // Update points
      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ 
          total_points: (activeMember?.total_points || profile?.total_points || 0) + task.points 
        })
        .eq('id', completerId);

      if (pointsError) throw pointsError;

      // Create points ledger entry
      const { error: ledgerError } = await supabase
        .from('points_ledger')
        .insert({
          profile_id: completerId,
          family_id: profile?.family_id,
          entry_type: 'earn',
          points: task.points,
          reason: `Completed task: ${task.title}`,
          task_id: task.id,
          created_by: completerId,
        });

      if (ledgerError) throw ledgerError;

      toast({
        title: 'Task completed!',
        description: `You earned ${task.points} points!`,
      });

      fetchProfile();
      if (profile?.family_id) {
        fetchTasks(profile.family_id);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', deletingTask.id);

      if (error) throw error;

      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });

      setDeletingTask(null);
      if (profile?.family_id) {
        fetchTasks(profile.family_id);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const handleTaskCreated = () => {
    if (profile?.family_id) {
      fetchTasks(profile.family_id);
    }
    setRefreshKey(prev => prev + 1);
  };

  const handleTaskEdited = () => {
    if (profile?.family_id) {
      fetchTasks(profile.family_id);
    }
    setEditingTask(null);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    // Handle task reordering if needed
  };

  const getTasksByStatus = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      overdue: tasks.filter(task => {
        const isCompleted = task.task_completions && task.task_completions.length > 0;
        if (isCompleted) return false;
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate < today;
      }),
      today: tasks.filter(task => {
        const isCompleted = task.task_completions && task.task_completions.length > 0;
        if (isCompleted) return false;
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate.toDateString() === today.toDateString();
      }),
      upcoming: tasks.filter(task => {
        const isCompleted = task.task_completions && task.task_completions.length > 0;
        if (isCompleted) return false;
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate > today;
      }),
      completed: tasks.filter(task => {
        return task.task_completions && task.task_completions.length > 0;
      }),
    };
  };

  const tasksByStatus = getTasksByStatus();

  const getTaskGroupIcon = (group: string) => {
    switch (group) {
      case 'morning': return <Sun className="h-4 w-4" />;
      case 'afternoon': return <Clock3 className="h-4 w-4" />;
      case 'evening': return <Moon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg">Unable to load profile</p>
          <Button onClick={() => signOut()} className="mt-4">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const displayMember = activeMember || profile;

  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <NavigationHeader
          profile={displayMember}
          familyMembers={familyMembers}
          isDashboardMode={isDashboardMode}
          isParent={isParent}
          onMemberSwitch={isDashboardMode ? () => setShowMemberSwitch(true) : undefined}
          onLogout={isDashboardMode ? handleDashboardLogout : undefined}
        />
        
        <div className="container mx-auto px-4 py-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="today" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Today
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="lists" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Lists
              </TabsTrigger>
              <TabsTrigger value="rewards" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Rewards
              </TabsTrigger>
              <TabsTrigger value="family" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {displayMember.display_name}!
                  </h1>
                  <p className="text-muted-foreground">
                    You have {displayMember.total_points} points
                  </p>
                </div>
                <AddTaskDialog
                  familyMembers={familyMembers}
                  familyId={profile.family_id}
                  profileId={displayMember.id}
                  onTaskCreated={handleTaskCreated}
                />
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Overdue Tasks */}
                  <Card className="border-destructive/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-destructive flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Overdue ({tasksByStatus.overdue.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Droppable droppableId="overdue">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                            {tasksByStatus.overdue.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <EnhancedTaskItem
                                      task={task}
                                      onComplete={() => handleTaskComplete(task)}
                                      onEdit={() => setEditingTask(task)}
                                      onDelete={() => setDeletingTask(task)}
                                      familyMembers={familyMembers}
                                      isOverdue={true}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </CardContent>
                  </Card>

                  {/* Today's Tasks */}
                  <Card className="border-warning/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-warning flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Due Today ({tasksByStatus.today.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Droppable droppableId="today">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                            {tasksByStatus.today.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <EnhancedTaskItem
                                      task={task}
                                      onComplete={() => handleTaskComplete(task)}
                                      onEdit={() => setEditingTask(task)}
                                      onDelete={() => setDeletingTask(task)}
                                      familyMembers={familyMembers}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </CardContent>
                  </Card>

                  {/* Upcoming Tasks */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-primary flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Upcoming ({tasksByStatus.upcoming.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Droppable droppableId="upcoming">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                            {tasksByStatus.upcoming.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <EnhancedTaskItem
                                      task={task}
                                      onComplete={() => handleTaskComplete(task)}
                                      onEdit={() => setEditingTask(task)}
                                      onDelete={() => setDeletingTask(task)}
                                      familyMembers={familyMembers}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </CardContent>
                  </Card>

                  {/* Completed Tasks */}
                  <Card className="border-success/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-success flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Completed ({tasksByStatus.completed.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Droppable droppableId="completed">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                            {tasksByStatus.completed.slice(0, 10).map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <EnhancedTaskItem
                                      task={task}
                                      onEdit={() => setEditingTask(task)}
                                      onDelete={() => setDeletingTask(task)}
                                      familyMembers={familyMembers}
                                      isCompleted={true}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </CardContent>
                  </Card>
                </div>
              </DragDropContext>
            </TabsContent>

            <TabsContent value="calendar" className="mt-6">
              <CalendarView
                key={refreshKey}
                familyMembers={familyMembers}
                familyId={profile.family_id}
                profileId={displayMember.id}
                onTaskCreated={handleTaskCreated}
              />
            </TabsContent>

            <TabsContent value="lists" className="mt-6">
              <Lists />
            </TabsContent>

            <TabsContent value="rewards" className="mt-6">
              <RewardsGallery profileId={displayMember.id} />
            </TabsContent>

            <TabsContent value="family" className="mt-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Family Members</CardTitle>
                    <CardDescription>
                      Manage your family and track everyone's progress
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {familyMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={member.display_name}
                              avatarUrl={member.avatar_url}
                              className="h-10 w-10"
                            />
                            <div>
                              <p className="font-medium">{member.display_name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {member.role}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{member.total_points} points</p>
                            <Badge variant="secondary" className={getMemberColorClasses(member.color)}>
                              {member.color}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        {editingTask && (
          <EditTaskDialog
            task={editingTask}
            familyMembers={familyMembers}
            open={!!editingTask}
            onOpenChange={(open) => !open && setEditingTask(null)}
            onTaskUpdated={handleTaskEdited}
          />
        )}

        <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
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

        {/* Dashboard mode dialogs */}
        <MemberSelectorDialog
          open={showMemberSelector}
          onOpenChange={setShowMemberSelector}
          familyMembers={familyMembers}
          onSelectMember={(member) => {
            setSelectedMemberForPin(member);
            setShowMemberSelector(false);
            setShowPinDialog(true);
          }}
        />

        <MemberPinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          member={selectedMemberForPin}
          onSuccess={(member) => {
            setActiveMember(member);
            setShowPinDialog(false);
            setSelectedMemberForPin(null);
          }}
        />

        <MemberSwitchDialog
          open={showMemberSwitch}
          onOpenChange={setShowMemberSwitch}
          currentMember={activeMember}
          familyMembers={familyMembers}
          onSelectMember={(member) => {
            setSelectedMemberForPin(member);
            setShowMemberSwitch(false);
            setShowPinDialog(true);
          }}
        />
      </div>
    </ChildAuthProvider>
  );
};

export default ColumnBasedDashboard;