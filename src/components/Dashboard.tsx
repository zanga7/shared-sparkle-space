import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, CheckCircle, Clock, Users } from 'lucide-react';
import { AddTaskDialog } from '@/components/AddTaskDialog';

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
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Fetch family tasks
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
          assigned_profile:profiles!tasks_assigned_to_fkey(id, display_name, role)
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
                    userId={user?.id || ''}
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
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{task.points} points</Badge>
                          {task.assigned_profile && (
                            <Badge variant="secondary">
                              Assigned to {task.assigned_profile.display_name}
                            </Badge>
                          )}
                          {task.is_repeating && (
                            <Badge variant="outline">Repeating</Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;