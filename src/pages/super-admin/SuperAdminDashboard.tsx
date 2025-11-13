import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, CheckSquare, List, Gift, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_stats');
      if (error) throw error;
      return data as {
        total_families: number;
        total_users: number;
        active_families_30d: number;
        total_tasks: number;
        total_events: number;
        total_lists: number;
        total_rewards: number;
        plans_breakdown: Record<string, number>;
      };
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">System-wide statistics and insights</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Families',
      value: stats?.total_families || 0,
      icon: Users,
      description: `${stats?.active_families_30d || 0} active in last 30 days`
    },
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      description: 'Across all families'
    },
    {
      title: 'Total Tasks',
      value: stats?.total_tasks || 0,
      icon: CheckSquare,
      description: 'System-wide'
    },
    {
      title: 'Total Events',
      value: stats?.total_events || 0,
      icon: Calendar,
      description: 'All family calendars'
    },
    {
      title: 'Total Lists',
      value: stats?.total_lists || 0,
      icon: List,
      description: 'Shopping & to-do lists'
    },
    {
      title: 'Total Rewards',
      value: stats?.total_rewards || 0,
      icon: Gift,
      description: 'Available rewards'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">System-wide statistics and insights</p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Plan Distribution
          </CardTitle>
          <CardDescription>Number of families on each subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.plans_breakdown && Object.entries(stats.plans_breakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-medium text-foreground">{plan}</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
