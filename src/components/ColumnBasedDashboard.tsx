import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Calendar, List, Users, Gift, Sun, Clock3, Moon, FileText } from 'lucide-react';
import { NavigationHeader } from '@/components/NavigationHeader';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { CalendarView } from '@/components/CalendarView';
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
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

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
          task_completions(id, completed_at, completed_by)
        `)
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTasks: Task[] = tasksData?.map(task => ({
        ...task,
        completion_rule: (task.completion_rule as 'any_one' | 'everyone') || 'everyone',
        assignees: [], // Simplified for now
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
      const completerId = profile?.id;
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
          total_points: (profile?.total_points || 0) + task.points 
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
  };

  const handleTaskEdited = () => {
    if (profile?.family_id) {
      fetchTasks(profile.family_id);
    }
    setEditingTask(null);
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

  // Simple TaskItem component for display
  const SimpleTaskItem = ({ task, onComplete, onEdit, onDelete }: {
    task: Task;
    onComplete?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
  }) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
    
    return (
      <Card className={cn(
        "p-3",
        isCompleted && "opacity-60",
        isOverdue && "border-destructive/50"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium text-sm",
              isCompleted && "line-through"
            )}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {task.points} pts
              </Badge>
              {task.due_date && (
                <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                  {format(new Date(task.due_date), 'MMM d')}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isCompleted && onComplete && (
              <Button size="sm" variant="ghost" onClick={onComplete}>
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
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

  return (
    <ChildAuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <NavigationHeader
          familyMembers={familyMembers}
          selectedMember={selectedMember}
          onMemberSelect={setSelectedMember}
          onSettingsClick={() => {}}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
        />
        
        <div className="container mx-auto px-4 py-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="lists">Lists</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-6 mt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {profile.display_name}!
                  </h1>
                  <p className="text-muted-foreground">
                    You have {profile.total_points} points
                  </p>
                </div>
                <AddTaskDialog
                  familyMembers={familyMembers}
                  familyId={profile.family_id}
                  profileId={profile.id}
                  onTaskCreated={handleTaskCreated}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Overdue Tasks */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Overdue ({tasksByStatus.overdue.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasksByStatus.overdue.map((task) => (
                        <SimpleTaskItem
                          key={task.id}
                          task={task}
                          onComplete={() => handleTaskComplete(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => setDeletingTask(task)}
                        />
                      ))}
                      {tasksByStatus.overdue.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No overdue tasks
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Today's Tasks */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-warning flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Due Today ({tasksByStatus.today.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasksByStatus.today.map((task) => (
                        <SimpleTaskItem
                          key={task.id}
                          task={task}
                          onComplete={() => handleTaskComplete(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => setDeletingTask(task)}
                        />
                      ))}
                      {tasksByStatus.today.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No tasks due today
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Upcoming Tasks */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-primary flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Upcoming ({tasksByStatus.upcoming.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasksByStatus.upcoming.map((task) => (
                        <SimpleTaskItem
                          key={task.id}
                          task={task}
                          onComplete={() => handleTaskComplete(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => setDeletingTask(task)}
                        />
                      ))}
                      {tasksByStatus.upcoming.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No upcoming tasks
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Completed Tasks */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-success flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Completed ({tasksByStatus.completed.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasksByStatus.completed.slice(0, 10).map((task) => (
                        <SimpleTaskItem
                          key={task.id}
                          task={task}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => setDeletingTask(task)}
                        />
                      ))}
                      {tasksByStatus.completed.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No completed tasks
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="mt-6">
              <CalendarView
                familyMembers={familyMembers}
                familyId={profile.family_id}
                profile={profile}
                tasks={tasks}
                onTaskUpdated={handleTaskCreated}
              />
            </TabsContent>

            <TabsContent value="lists" className="mt-6">
              <Lists />
            </TabsContent>

            <TabsContent value="rewards" className="mt-6">
              <RewardsGallery selectedMemberId={profile.id} />
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
                            <Badge variant="secondary">
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
      </div>
    </ChildAuthProvider>
  );
};

export default ColumnBasedDashboard;