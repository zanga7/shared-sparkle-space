import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Plus, Settings, Pause, Play, SkipForward, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useRotatingTasks } from '@/hooks/useRotatingTasks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotatingTaskDialog } from '@/components/RotatingTaskDialog';
import { Profile } from '@/types/task';
import { RotatingTask } from '@/types/rotating-tasks';
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

const RotatingTasksManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RotatingTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<RotatingTask | null>(null);

  const { 
    rotatingTasks, 
    createRotatingTask, 
    updateRotatingTask, 
    deleteRotatingTask,
    skipCurrentMember,
    togglePauseTask 
  } = useRotatingTasks(profile?.family_id);

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

      if (profileError) throw profileError;
      
      if (profileData.role !== 'parent') {
        toast({
          title: 'Access Denied',
          description: 'You must be a parent to access rotating tasks management.',
          variant: 'destructive'
        });
        return;
      }

      setProfile(profileData);

      // Fetch family members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      setFamilyMembers(membersData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rotating tasks data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    if (!profile) return;

    await createRotatingTask({
      ...taskData,
      family_id: profile.family_id,
      created_by: profile.id
    });
  };

  const handleUpdateTask = async (taskData: any) => {
    if (!editingTask) return;

    await updateRotatingTask(editingTask.id, taskData);
    setEditingTask(null);
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;

    await deleteRotatingTask(deletingTask.id);
    setDeletingTask(null);
  };

  const getCurrentMember = (task: RotatingTask) => {
    if (task.member_order.length === 0) return null;
    const currentMemberId = task.member_order[task.current_member_index];
    return familyMembers.find(m => m.id === currentMemberId) || null;
  };

  const getNextMember = (task: RotatingTask) => {
    if (task.member_order.length === 0) return null;
    const nextIndex = (task.current_member_index + 1) % task.member_order.length;
    const nextMemberId = task.member_order[nextIndex];
    return familyMembers.find(m => m.id === nextMemberId) || null;
  };

  const formatCadence = (task: RotatingTask) => {
    if (task.cadence === 'daily') {
      return 'Daily';
    } else if (task.cadence === 'weekly') {
      if (task.weekly_days && task.weekly_days.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = task.weekly_days.map(d => dayNames[d]).join(', ');
        return `Weekly on ${selectedDays}`;
      }
      return 'Weekly';
    } else if (task.cadence === 'monthly') {
      return `Monthly on day ${task.monthly_day}`;
    }
    return task.cadence;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading rotating tasks...</div>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'parent') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold">Access Denied</div>
              <p className="text-muted-foreground mt-2">
                You must be a parent to access rotating tasks management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rotating Tasks Management</h1>
          <p className="text-muted-foreground">
            Create and manage rotating task assignments for your family
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rotating Task
        </Button>
      </div>

      {/* Rotating Tasks List */}
      <div className="grid gap-4">
        {rotatingTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Rotating Tasks</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first rotating task to automatically assign responsibilities to family members.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rotating Task
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          rotatingTasks.map((task) => {
            const currentMember = getCurrentMember(task);
            const nextMember = getNextMember(task);

            return (
              <Card key={task.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {task.name}
                        <Badge variant={task.is_active && !task.is_paused ? "default" : "secondary"}>
                          {task.is_paused ? "Paused" : task.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {formatCadence(task)} • {task.points} points
                        {task.description && ` • ${task.description}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTask(task)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingTask(task)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Current Assignment */}
                    <div>
                      <h4 className="font-medium mb-3">Current Assignment</h4>
                      {currentMember ? (
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={currentMember.display_name}
                              color={currentMember.color}
                              size="md"
                            />
                            <div>
                              <div className="font-medium">{currentMember.display_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Currently responsible for this task
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => skipCurrentMember(task.id)}
                              disabled={task.is_paused}
                            >
                              <SkipForward className="h-4 w-4 mr-1" />
                              Skip Turn
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePauseTask(task.id)}
                            >
                              {task.is_paused ? (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Resume
                                </>
                              ) : (
                                <>
                                  <Pause className="h-4 w-4 mr-1" />
                                  Pause
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/20">
                          No members assigned to this rotation
                        </div>
                      )}
                    </div>

                    {/* Rotation Order */}
                    <div>
                      <h4 className="font-medium mb-3">Rotation Order</h4>
                      <div className="flex flex-wrap gap-2">
                        {task.member_order.map((memberId, index) => {
                          const member = familyMembers.find(m => m.id === memberId);
                          if (!member) return null;

                          const isCurrent = index === task.current_member_index;
                          const isNext = index === (task.current_member_index + 1) % task.member_order.length;

                          return (
                            <div 
                              key={memberId}
                              className={`flex items-center gap-2 p-3 border rounded-lg ${
                                isCurrent ? 'bg-primary/10 border-primary' : 
                                isNext ? 'bg-orange-50 border-orange-200' : 
                                'bg-background'
                              }`}
                            >
                              <Badge variant="outline" className="text-xs">
                                {index + 1}
                              </Badge>
                              <UserAvatar
                                name={member.display_name}
                                color={member.color}
                                size="sm"
                              />
                              <div className="text-sm">
                                {member.display_name}
                                {isCurrent && <span className="text-primary font-medium ml-1">(Current)</span>}
                                {isNext && <span className="text-orange-600 font-medium ml-1">(Next)</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Task Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Created</div>
                        <div className="text-muted-foreground">
                          {format(new Date(task.created_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Last Updated</div>
                        <div className="text-muted-foreground">
                          {format(new Date(task.updated_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Members</div>
                        <div className="text-muted-foreground">
                          {task.member_order.length} in rotation
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Points</div>
                        <div className="text-muted-foreground">
                          {task.points} per completion
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <RotatingTaskDialog
        open={isCreateDialogOpen || editingTask !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        familyMembers={familyMembers}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        editingTask={editingTask}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingTask !== null} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rotating Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RotatingTasksManagement;