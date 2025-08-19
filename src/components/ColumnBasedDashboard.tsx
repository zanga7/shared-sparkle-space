import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Edit, Trash2, Calendar, List, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { RecurringSeriesDialog } from '@/components/RecurringSeriesDialog';
import { CalendarView } from '@/components/CalendarView';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
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
import { Task, Profile } from '@/types/task';

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
  const { taskSeries } = useRecurringTasks(profile?.family_id);

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

      // Fetch family members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id);

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
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role),
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

  // Get tasks organized by family member
  const getTasksByMember = () => {
    const tasksByMember = new Map<string, Task[]>();
    
    // Initialize with all family members
    familyMembers.forEach(member => {
      tasksByMember.set(member.id, []);
    });
    
    // Add unassigned tasks category
    tasksByMember.set('unassigned', []);
    
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Family Chores</h1>
            <p className="text-muted-foreground">Welcome back, {profile.display_name}!</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={profile.role === 'parent' ? 'default' : 'secondary'}>
              {profile.role === 'parent' ? 'Parent' : 'Child'}
            </Badge>
            {profile.role === 'parent' && (
              <>
                <Button variant="outline" asChild>
                  <a href="/admin">Admin Panel</a>
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="columns" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="columns" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="mt-6">
            <div className="w-full overflow-x-auto touch-pan-x">
              <div className="flex gap-4 pb-4" style={{ minWidth: 'fit-content' }}>
                {/* Family member columns */}
                {familyMembers.map(member => {
                  const memberTasks = tasksByMember.get(member.id) || [];
                  const completedTasks = memberTasks.filter(task => 
                    task.task_completions && task.task_completions.length > 0
                  );
                  const pendingTasks = memberTasks.filter(task => 
                    !task.task_completions || task.task_completions.length === 0
                  );

                  return (
                    <Card key={member.id} className="flex-shrink-0 w-80 h-fit border-primary/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback 
                              className="text-primary-foreground font-semibold bg-primary"
                            >
                              {getInitials(member.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg">{member.display_name}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant={member.role === 'parent' ? 'default' : 'secondary'} className="text-xs">
                                {member.role}
                              </Badge>
                              <span>{member.total_points} pts</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{pendingTasks.length} pending</span>
                          <span>{completedTasks.length} completed</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-3 mb-4">
                          {memberTasks.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No tasks assigned</p>
                            </div>
                          ) : (
                            memberTasks.map(task => (
                              <div key={task.id} className="space-y-2">
                                <EnhancedTaskItem
                                  task={task}
                                  allTasks={tasks}
                                  familyMembers={familyMembers}
                                  onToggle={handleTaskToggle}
                                  onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                                  onDelete={profile.role === 'parent' ? setDeletingTask : undefined}
                                  showActions={profile.role === 'parent'}
                                />
                              </div>
                            ))
                          )}
                        </div>
                        
                        {/* Add Task Button */}
                        {profile.role === 'parent' && (
                          <Button 
                            variant="outline" 
                            className="w-full border-dashed border-primary/40 text-primary hover:border-primary hover:text-primary"
                            onClick={() => handleAddTaskForMember(member.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task for {member.display_name}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Unassigned tasks column */}
                {tasksByMember.get('unassigned')?.length > 0 && (
                  <Card className="flex-shrink-0 w-80 h-fit">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            ?
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">Unassigned</CardTitle>
                          <CardDescription>Anyone can complete these</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-3 mb-4">
                        {tasksByMember.get('unassigned')?.map(task => (
                          <div key={task.id} className="space-y-2">
                            <EnhancedTaskItem
                              task={task}
                              allTasks={tasks}
                              familyMembers={familyMembers}
                              onToggle={handleTaskToggle}
                              onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                              onDelete={profile.role === 'parent' ? setDeletingTask : undefined}
                              showActions={profile.role === 'parent'}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Add Unassigned Task Button */}
                      {profile.role === 'parent' && (
                        <Button 
                          variant="outline" 
                          className="w-full border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                          onClick={() => handleAddTaskForMember('unassigned')}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Unassigned Task
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <CalendarView
              tasks={tasks}
              familyMembers={familyMembers}
              onTaskUpdated={fetchUserData}
              onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
            />
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