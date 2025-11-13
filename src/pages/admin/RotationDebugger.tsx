import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface RotatingTask {
  id: string;
  name: string;
  description: string | null;
  member_order: string[];
  current_member_index: number;
  cadence: string;
  is_active: boolean;
  is_paused: boolean;
}

interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_url?: string | null;
}

interface Task {
  id: string;
  title: string;
  rotating_task_id: string | null;
  created_at: string;
  task_completions: { id: string }[];
  assignees: { profile: Profile }[];
}

interface RotationEvent {
  id: string;
  created_at: string;
  source: string;
  previous_index: number | null;
  selected_index: number | null;
  next_index: number | null;
  chosen_member_id: string | null;
  status: string;
  reason: string | null;
  profile: Profile | null;
}

export default function RotationDebugger() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rotatingTasks, setRotatingTasks] = useState<RotatingTask[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [todaysTasks, setTodaysTasks] = useState<Map<string, Task[]>>(new Map());
  const [events, setEvents] = useState<Map<string, RotationEvent[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!currentProfile) return;

      // Fetch family profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, color')
        .eq('family_id', currentProfile.family_id);

      const profileMap = new Map<string, Profile>();
      profilesData?.forEach(p => profileMap.set(p.id, p));
      setProfiles(profileMap);

      // Fetch rotating tasks
      const { data: tasksData } = await supabase
        .from('rotating_tasks')
        .select('*')
        .eq('family_id', currentProfile.family_id)
        .order('name');

      setRotatingTasks(tasksData || []);

      // Fetch today's task instances for each rotating task
      const today = new Date().toISOString().split('T')[0];
      const tasksMap = new Map<string, Task[]>();

      for (const rt of tasksData || []) {
        const { data: instances } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            rotating_task_id,
            created_at,
            task_completions(id),
            assignees:task_assignees(profile:profiles!task_assignees_profile_id_fkey(id, display_name, color))
          `)
          .eq('rotating_task_id', rt.id)
          .gte('created_at', `${today}T00:00:00Z`)
          .lte('created_at', `${today}T23:59:59Z`)
          .order('created_at', { ascending: false });

        tasksMap.set(rt.id, instances || []);
      }
      setTodaysTasks(tasksMap);

      // Fetch recent rotation events
      const eventsMap = new Map<string, RotationEvent[]>();

      for (const rt of tasksData || []) {
        const { data: eventsData } = await supabase
          .from('rotation_events')
          .select(`
            id,
            created_at,
            source,
            previous_index,
            selected_index,
            next_index,
            chosen_member_id,
            status,
            reason,
            profile:profiles(id, display_name, color)
          `)
          .eq('rotating_task_id', rt.id)
          .order('created_at', { ascending: false })
          .limit(10);

        eventsMap.set(rt.id, eventsData || []);
      }
      setEvents(eventsMap);

    } catch (error) {
      console.error('Error fetching rotation data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rotation data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToday = async (rotatingTaskId: string, taskName: string) => {
    try {
      setGenerating(rotatingTaskId);
      const { data, error } = await supabase.functions.invoke('generate-rotating-tasks', {
        body: { rotating_task_id: rotatingTaskId }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Generated tasks for ${taskName}. ${data?.count || 0} tasks created.`,
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error generating tasks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate tasks',
        variant: 'destructive',
      });
    } finally {
      setGenerating(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getNextUpMember = (task: RotatingTask): Profile | null => {
    const nextIndex = task.current_member_index;
    const memberId = task.member_order[nextIndex];
    return memberId ? profiles.get(memberId) || null : null;
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Rotation Debugger</h1>
        </div>
        <p className="text-muted-foreground">Loading rotation data...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Rotation Debugger</h1>
            <p className="text-muted-foreground">Diagnose and monitor rotating task behavior</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {rotatingTasks.map((task) => {
          const nextUp = getNextUpMember(task);
          const instances = todaysTasks.get(task.id) || [];
          const recentEvents = events.get(task.id) || [];
          const hasIssues = instances.length > 1 || recentEvents.some(e => e.status === 'failed');

          return (
            <Card key={task.id} className={hasIssues ? 'border-amber-500/50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{task.name}</CardTitle>
                      {hasIssues && (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
                      {!task.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {task.is_paused && (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </div>
                    <CardDescription>
                      Cadence: {task.cadence} • Current index: {task.current_member_index}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateToday(task.id, task.name)}
                    disabled={generating === task.id}
                  >
                    {generating === task.id ? 'Generating...' : 'Generate Today'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Member rotation order */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Rotation Order:</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.member_order.map((memberId, idx) => {
                      const member = profiles.get(memberId);
                      const isNext = idx === task.current_member_index;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
                            isNext ? 'border-primary bg-primary/10' : 'border-border'
                          }`}
                        >
                          <span className="text-xs text-muted-foreground">#{idx}</span>
                          {member ? (
                            <>
                              <UserAvatar
                                name={member.display_name}
                                color={member.color}
                                avatarIcon={member.avatar_url || undefined}
                                size="sm"
                              />
                              <span className="text-sm">{member.display_name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unknown</span>
                          )}
                          {isNext && (
                            <Badge variant="default" className="ml-1">Next Up</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Today's instances */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Today's Instances ({instances.length}):</h4>
                  {instances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No instances created today</p>
                  ) : (
                    <div className="space-y-2">
                      {instances.map((instance) => {
                        const assignee = instance.assignees?.[0]?.profile;
                        const isComplete = instance.task_completions?.length > 0;
                        return (
                          <div
                            key={instance.id}
                            className="flex items-center justify-between p-3 rounded-md border border-border"
                          >
                            <div className="flex items-center gap-3">
                              {assignee ? (
                                <>
                                  <UserAvatar
                                    name={assignee.display_name}
                                    color={assignee.color}
                                    avatarIcon={assignee.avatar_url || undefined}
                                    size="sm"
                                  />
                                  <div>
                                    <p className="text-sm font-medium">{assignee.display_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Created {format(new Date(instance.created_at), 'h:mm a')}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">No assignee</p>
                              )}
                            </div>
                            <Badge variant={isComplete ? 'default' : 'secondary'}>
                              {isComplete ? 'Completed' : 'Incomplete'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent rotation events */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Recent Events ({recentEvents.length}):</h4>
                  {recentEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent events</p>
                  ) : (
                    <div className="space-y-2">
                      {recentEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-3 rounded-md border border-border"
                        >
                          <div className="mt-0.5">{getStatusIcon(event.status)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {event.source}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              {event.previous_index !== null && event.next_index !== null && (
                                <p>
                                  Index: {event.previous_index} → {event.next_index}
                                </p>
                              )}
                              {event.profile && (
                                <p>
                                  Chosen: <span className="font-medium">{event.profile.display_name}</span>
                                </p>
                              )}
                              {event.reason && (
                                <p className="text-muted-foreground text-xs">{event.reason}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {rotatingTasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No rotating tasks found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
