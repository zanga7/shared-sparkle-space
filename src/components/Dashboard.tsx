import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Users, Edit, Trash2, Repeat, BarChart3, Settings, Calendar, List } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { useTaskSeries } from '@/hooks/useTaskSeries';

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
import { Task, Profile } from '@/types/task';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  

  
  const { generateVirtualTaskInstances, createTaskException } = useTaskSeries(profile?.family_id);
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
      const { data: regularTasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          points,
          due_date,
          assigned_to,
          created_by,
          completion_rule,
          task_group,
          recurrence_options,
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role, color),
          assignees:task_assignees(id, profile_id, assigned_at, assigned_by, profile:profiles!task_assignees_profile_id_fkey(id, display_name, role, color)),
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', profileData.family_id)
        .is('recurrence_options', null); // Only get non-recurring tasks

      if (tasksError) {
        console.error('Tasks error:', tasksError);
      } else {
        // Get virtual task instances from series (for the next 30 days)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        const virtualTasks = generateVirtualTaskInstances(startDate, endDate);
        
        // Combine regular tasks with virtual instances
        const regularTasks = (regularTasksData || []).map(task => ({
          ...task,
          completion_rule: (task.completion_rule || 'everyone') as 'any_one' | 'everyone',
          recurrence_options: task.recurrence_options as any // Type cast to fix JSON compatibility
        }));
        
        // Convert virtual tasks to Task format
        const virtualTasksAsRegular = virtualTasks.map(vTask => ({
          id: vTask.id,
          title: vTask.title,
          description: vTask.description,
          points: vTask.points,
          due_date: vTask.due_date,
          assigned_to: vTask.assigned_profiles.length === 1 ? vTask.assigned_profiles[0] : null,
          created_by: vTask.created_by,
          completion_rule: vTask.completion_rule as 'any_one' | 'everyone',
          task_group: vTask.task_group,
          recurrence_options: null, // Virtual tasks don't have individual recurrence options
          // Add virtual task metadata
          isVirtual: vTask.isVirtual,
          series_id: vTask.series_id,
          occurrence_date: vTask.occurrence_date,
          isException: vTask.isException,
          exceptionType: vTask.exceptionType,
          // Convert assigned_profiles to assignees format
          assignees: vTask.assigned_profiles.map(profileId => {
            const profile = familyMembers.find(m => m.id === profileId);
            return {
              id: `virtual-${vTask.id}-${profileId}`,
              profile_id: profileId,
              assigned_at: vTask.due_date,
              assigned_by: vTask.created_by,
              profile: {
                id: profileId,
                display_name: profile?.display_name || 'Unknown',
                role: profile?.role || 'child',
                color: profile?.color || 'sky'
              }
            };
          }),
          task_completions: [] // Virtual tasks don't have completions yet
        }));
        
        setTasks([...regularTasks, ...virtualTasksAsRegular]);
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
    
    // Handle virtual task completion
    if ((task as any).isVirtual && (task as any).series_id) {
      try {
        // For virtual tasks, we need to create a completion exception
        await createTaskException({
          series_id: (task as any).series_id,
          exception_date: (task as any).occurrence_date,
          exception_type: 'override',
          override_data: {
            completed: true,
            completed_by: profile.id,
            completed_at: new Date().toISOString(),
            points_earned: task.points
          },
          created_by: profile.id
        });

        // Update profile points
        const { error: pointsError } = await supabase
          .from('profiles')
          .update({
            total_points: profile.total_points + task.points
          })
          .eq('id', profile.id);

        if (pointsError) throw pointsError;

        toast({
          title: 'Task Completed!',
          description: `You earned ${task.points} points!`,
        });

        fetchUserData();
        return;
      } catch (error) {
        console.error('Error completing virtual task:', error);
        toast({
          title: 'Error',
          description: 'Failed to complete task',
          variant: 'destructive'
        });
        return;
      }
    }
    
    try {
      // Get all assignees for this task (including both old and new format)
      const assignees = task.assignees?.map(a => a.profile) || 
                       (task.assigned_profile ? [task.assigned_profile] : []);
      
      // Check if current profile is allowed to complete this task
      const isAssignee = assignees.some(assignee => assignee.id === profile.id);
      if (assignees.length > 0 && !isAssignee) {
        toast({
          title: 'Cannot Complete Task',
          description: 'Only assigned members can complete this task.',
          variant: 'destructive'
        });
        return;
      }
      
      // Determine point recipients based on completion rule
      let pointRecipients;
      if (task.completion_rule === 'any_one' && assignees.length > 1) {
        // "Any one" rule: only the completer gets points
        pointRecipients = [profile];
      } else {
        // "Everyone" rule or single assignee: only the completer gets points
        pointRecipients = [profile];
      }
      
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

      // Award points based on completion rule
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

      // Create toast message based on completion rule and point distribution
      let toastMessage;
      if (task.completion_rule === 'any_one' && assignees.length > 1) {
        const assigneeNames = assignees.map(a => a.display_name).join(', ');
        toastMessage = `Task completed for everyone! ${profile.display_name} earned ${task.points} points. Assignees: ${assigneeNames}`;
      } else if (pointRecipients.length === 1 && pointRecipients[0].id === profile.id) {
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
    
    // Handle virtual task uncompletion
    if ((task as any).isVirtual && (task as any).series_id) {
      try {
        // For virtual tasks, remove the completion exception
        const { error } = await supabase
          .from('recurrence_exceptions')
          .delete()
          .eq('series_id', (task as any).series_id)
          .eq('exception_date', (task as any).occurrence_date)
          .eq('exception_type', 'override');

        if (error) throw error;

        // Update profile points
        const { error: pointsError } = await supabase
          .from('profiles')
          .update({
            total_points: profile.total_points - task.points
          })
          .eq('id', profile.id);

        if (pointsError) throw pointsError;

        toast({
          title: 'Task Uncompleted',
          description: `${task.points} points removed`,
        });

        fetchUserData();
        return;
      } catch (error) {
        console.error('Error uncompleting virtual task:', error);
        toast({
          title: 'Error',
          description: 'Failed to uncomplete task',
          variant: 'destructive'
        });
        return;
      }
    }
    
    try {
      // Find the completion record by the current user
      const userCompletion = task.task_completions.find(completion => completion.completed_by === profile.id);
      
      if (!userCompletion) {
        return;
      }

      // Get all assignees who received points based on completion rule
      let assignees;
      const allAssignees = task.assignees?.map(a => a.profile) || 
                          (task.assigned_profile ? [task.assigned_profile] : []);
      
      if (task.completion_rule === 'any_one' && allAssignees.length > 1) {
        // For "any_one" tasks, only the completer received points
        assignees = [profile];
      } else {
        // For "everyone" tasks or single assignee, only the completer received points
        assignees = [profile];
      }

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

      // Create toast message based on point removal
      let toastMessage;
      if (assignees.length === 1) {
        toastMessage = `${task.points} points removed`;
      } else {
        const names = assignees.map(p => p.display_name).join(', ');
        toastMessage = `${task.points} points removed from: ${names}`;
      }

      toast({
        title: 'Task Uncompleted',
        description: toastMessage,
      });

      // Refresh the data
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
    // For virtual tasks, check if there's a completion exception
    const isCompleted = (task as any).isVirtual 
      ? (task as any).isException && (task as any).exceptionType === 'override' && (task as any).overrideData?.completed
      : task.task_completions && task.task_completions.length > 0;
      
    if (isCompleted) {
      uncompleteTask(task);
    } else {
      completeTask(task);
    }
  };

  const deleteTask = async () => {
    if (!deletingTask) return;

    // Handle virtual task deletion (skip occurrence)
    if ((deletingTask as any).isVirtual && (deletingTask as any).series_id) {
      try {
        await createTaskException({
          series_id: (deletingTask as any).series_id,
          exception_date: (deletingTask as any).occurrence_date,
          exception_type: 'skip',
          created_by: profile?.id || ''
        });

        toast({
          title: 'Task Skipped',
          description: 'This occurrence has been skipped',
        });

        setDeletingTask(null);
        fetchUserData();
        return;
      } catch (error) {
        console.error('Error skipping virtual task:', error);
        toast({
          title: 'Error',
          description: 'Failed to skip task occurrence',
          variant: 'destructive'
        });
        return;
      }
    }

    // Regular task deletion
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
              <Button variant="outline" asChild>
                <a href="/admin">Admin Panel</a>
              </Button>
            )}
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Task List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-6 mt-6">
            <div className="space-y-6">
              {/* Enhanced Tasks Overview */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Family Tasks</CardTitle>
                      <CardDescription>
                        Current chores and activities with progress tracking
                      </CardDescription>
                    </div>
                    {profile.role === 'parent' && (
                      <div className="flex gap-2">
                        
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tasks yet. {profile.role === 'parent' ? 'Create your first task!' : 'Ask a parent to create some tasks.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <EnhancedTaskItem
                          key={task.id}
                          task={task}
                          allTasks={tasks}
                          familyMembers={familyMembers}
                          onToggle={handleTaskToggle}
                          onEdit={profile.role === 'parent' ? setEditingTask : undefined}
                          onDelete={profile.role === 'parent' ? setDeletingTask : undefined}
                          showActions={profile.role === 'parent'}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <CalendarView 
              tasks={tasks}
              familyMembers={familyMembers}
              onTaskUpdated={fetchUserData}
              onCreateTask={profile.role === 'parent' ? (date) => {
                setSelectedDate(date);
                setIsAddDialogOpen(true);
              } : undefined}
              onEditTask={profile.role === 'parent' ? setEditingTask : undefined}
              familyId={profile.family_id}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Task Dialog */}
      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          familyMembers={familyMembers}
          familyId={profile.family_id}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onTaskUpdated={fetchUserData}
        />
      )}


      {/* Add Task Dialog */}
      {isAddDialogOpen && (
        <AddTaskDialog
          familyMembers={familyMembers}
          familyId={profile?.family_id || ''}
          profileId={profile?.id || ''}
          selectedDate={selectedDate}
          onTaskCreated={() => {
            fetchUserData();
            setSelectedDate(null);
          }}
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              {(deletingTask as any)?.isVirtual 
                ? `Are you sure you want to skip this occurrence of "${deletingTask?.title}"?`
                : `Are you sure you want to delete "${deletingTask?.title}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {(deletingTask as any)?.isVirtual ? 'Skip Occurrence' : 'Delete Task'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;