import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PageHeading, SmallText } from '@/components/ui/typography';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Shield, 
  Activity, 
  Database, 
  AlertCircle, 
  TrendingUp,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { ExtendedProfile, AuditLog } from '@/types/admin';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<ExtendedProfile[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    archivedMembers: 0,
    totalTasks: 0,
    completedTasks: 0,
    recentActivity: 0
  });

  useEffect(() => {
    if (user) {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      // Fetch current user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      
      // Check if user is a parent (admin)
      if (profileData.role !== 'parent') {
        toast({
          title: 'Access Denied',
          description: 'You must be a parent to access the admin dashboard.',
          variant: 'destructive'
        });
        return;
      }

      setProfile(profileData as ExtendedProfile);

      // Fetch family members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profileData.family_id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      setFamilyMembers((membersData || []) as ExtendedProfile[]);

      // Fetch recent audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('family_id', profileData.family_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (auditError) throw auditError;
      setRecentAuditLogs((auditData || []) as AuditLog[]);

      // Fetch tasks for statistics
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          task_completions(id)
        `)
        .eq('family_id', profileData.family_id);

      if (tasksError) throw tasksError;

      // Calculate statistics
      const totalMembers = membersData?.length || 0;
      const activeMembers = membersData?.filter(m => m.status === 'active').length || 0;
      const archivedMembers = totalMembers - activeMembers;
      const totalTasks = tasksData?.length || 0;
      const completedTasks = tasksData?.filter(t => t.task_completions && t.task_completions.length > 0).length || 0;
      const recentActivity = auditData?.filter(log => 
        new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0;

      setStats({
        totalMembers,
        activeMembers,
        archivedMembers,
        totalTasks,
        completedTasks,
        recentActivity
      });

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'update': return <Activity className="h-4 w-4 text-blue-500" />;
      case 'delete': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading admin dashboard...</div>
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
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <div className="text-lg font-semibold">Access Denied</div>
              <p className="text-muted-foreground mt-2">
                You must be a parent to access the admin dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-padding component-spacing">
      {/* Header */}
      <div className="section-spacing">
        <PageHeading>Admin Dashboard</PageHeading>
        <SmallText>
          Manage your family's chore system and settings
        </SmallText>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeMembers} active, {stats.archivedMembers} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} of {stats.totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivity}</div>
            <p className="text-xs text-muted-foreground">
              Actions in the last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Family Members Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Family Members
            </CardTitle>
            <CardDescription>
              Current family member status and roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {familyMembers.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <UserAvatar 
                    name={member.display_name}
                    color={member.color}
                    avatarIcon={member.avatar_url || undefined}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.display_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.total_points} points
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'parent' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                    <Badge variant={member.status === 'active' ? 'secondary' : 'outline'}>
                      {member.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {familyMembers.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{familyMembers.length - 5} more members
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest system activity and changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAuditLogs.length > 0 ? (
                recentAuditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-center gap-3">
                    {getActionIcon(log.action)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm capitalize">
                        {log.action} {log.entity_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a 
              href="/admin/members" 
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Users className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Manage Members</span>
            </a>
            <a 
              href="/admin/permissions" 
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Shield className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Set Permissions</span>
            </a>
            <a 
              href="/admin/categories" 
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Database className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Manage Categories</span>
            </a>
            <a 
              href="/admin/rotating-tasks" 
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Activity className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Rotating Tasks</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;