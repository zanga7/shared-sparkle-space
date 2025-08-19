import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Users, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
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

interface Profile {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
  total_points: number;
  avatar_url?: string;
  family_id: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  points: number;
  is_repeating: boolean;
  due_date?: string;
  assigned_to?: string;
  assigned_profile?: {
    id: string;
    display_name: string;
    role: 'parent' | 'child';
  };
  task_completions?: Array<{
    id: string;
    completed_at: string;
    completed_by: string;
  }>;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

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
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role),
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

      // Update user's total points
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          total_points: profile.total_points + task.points
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Task Completed!',
        description: `You earned ${task.points} points!`,
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
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Family Members Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Family Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {familyMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback>
                        {member.display_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{member.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {member.total_points} points
                      </div>
                    </div>
                    <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tasks Overview */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Family Tasks</CardTitle>
                  <CardDescription>
                    Current chores and activities
                  </CardDescription>
                </div>
                {profile.role === 'parent' && (
                  <AddTaskDialog
                    familyMembers={familyMembers}
                    familyId={profile.family_id}
                    profileId={profile.id}
                    onTaskCreated={fetchUserData}
                  />
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
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isCompleted = task.task_completions && task.task_completions.length > 0;
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
                    
                    return (
                      <div 
                        key={task.id} 
                        className={cn(
                          "group relative flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors",
                          isCompleted && "opacity-60 bg-muted/30",
                          isOverdue && "border-destructive/50"
                        )}
                      >
                        {/* Complete button at front */}
                        <Button 
                          size="sm" 
                          variant={isCompleted ? "default" : "outline"}
                          onClick={() => completeTask(task)}
                          className="shrink-0"
                          disabled={isCompleted}
                        >
                          <CheckCircle className={cn("h-4 w-4", isCompleted && "text-green-500")} />
                        </Button>
                        
                        {/* Task details */}
                        <div className="flex-1 min-w-0">
                          <h3 className={cn("font-medium", isCompleted && "line-through")}>
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{task.points} pts</Badge>
                            {task.assigned_profile && (
                              <Badge variant="secondary" className="text-xs">
                                {task.assigned_profile.display_name}
                              </Badge>
                            )}
                            {task.is_repeating && (
                              <Badge variant="outline" className="text-xs">Repeating</Badge>
                            )}
                            {task.due_date && (
                              <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                                Due {format(new Date(task.due_date), "MMM d")}
                              </Badge>
                            )}
                            {isCompleted && (
                              <Badge variant="default" className="text-xs bg-green-500">Completed</Badge>
                            )}
                          </div>
                        </div>

                        {/* Hover actions for parents */}
                        {profile.role === 'parent' && !isCompleted && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTask(task)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingTask(task)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Edit Task Dialog */}
      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          familyMembers={familyMembers}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onTaskUpdated={fetchUserData}
        />
      )}

      {/* Delete Confirmation Dialog */}
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
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;