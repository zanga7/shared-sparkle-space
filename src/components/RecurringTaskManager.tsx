import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, RotateCcw, AlertCircle } from 'lucide-react';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { useRecurringTaskInstances } from '@/hooks/useRecurringTaskInstances';
import { format, isToday, isPast } from 'date-fns';

interface RecurringTaskManagerProps {
  familyId: string;
  familyMembers: any[];
}

export const RecurringTaskManager: React.FC<RecurringTaskManagerProps> = ({
  familyId,
  familyMembers
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  const { taskSeries, loading: seriesLoading } = useRecurringTasks(familyId);
  
  // Get instances for selected month
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  
  const { 
    instances, 
    loading: instancesLoading,
    completeInstance,
    refresh
  } = useRecurringTaskInstances(familyId, { 
    start: monthStart, 
    end: monthEnd 
  });

  const loading = seriesLoading || instancesLoading;

  const getInstanceStatus = (instance: any) => {
    const hasCompletions = instance.task_completions && instance.task_completions.length > 0;
    const dueDate = new Date(instance.due_date);
    
    if (hasCompletions) return 'completed';
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'due-today';
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'due-today': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRecurrenceRule = (series: any) => {
    let rule = `Every `;
    
    if (series.recurring_frequency === 'daily') {
      rule += series.recurring_interval === 1 ? 'day' : `${series.recurring_interval} days`;
    } else if (series.recurring_frequency === 'weekly') {
      if (series.recurring_days_of_week && series.recurring_days_of_week.length > 0) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = series.recurring_days_of_week.map((d: number) => days[d]).join(', ');
        rule += `week on ${dayNames}`;
      } else {
        rule += series.recurring_interval === 1 ? 'week' : `${series.recurring_interval} weeks`;
      }
    } else if (series.recurring_frequency === 'monthly') {
      rule += series.recurring_interval === 1 ? 'month' : `${series.recurring_interval} months`;
    }
    
    return rule;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 animate-spin" />
            Loading Recurring Tasks...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Navigator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recurring Tasks for {format(selectedMonth, 'MMMM yyyy')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              >
                Next
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Dynamic recurring task instances - generated on demand without creating database clutter
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Active Series Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {taskSeries.map((series) => {
          const seriesInstances = instances.filter(i => i.series_id === series.id);
          const completedCount = seriesInstances.filter(i => 
            i.task_completions && i.task_completions.length > 0
          ).length;
          
          return (
            <Card key={series.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{series.title}</CardTitle>
                <CardDescription className="text-sm">
                  {formatRecurrenceRule(series)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>This month:</span>
                  <Badge variant="secondary">
                    {completedCount}/{seriesInstances.length} completed
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {series.points} points per task
                </div>
                {series.assigned_to && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {familyMembers.find(m => m.id === series.assigned_to)?.display_name || 'Unknown'}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Generated Instances */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Task Instances ({instances.length})</CardTitle>
          <CardDescription>
            These tasks are generated dynamically from your recurring rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              No recurring task instances for this month
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((instance) => {
                const status = getInstanceStatus(instance);
                const assignedMember = familyMembers.find(m => m.id === instance.assigned_to);
                
                return (
                  <div key={instance.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">{instance.title}</h4>
                        <Badge className={getStatusColor(status)}>
                          {status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Due: {format(new Date(instance.due_date!), 'MMM dd')}</span>
                        <span>{instance.points} points</span>
                        {assignedMember && (
                          <span>Assigned to: {assignedMember.display_name}</span>
                        )}
                      </div>
                    </div>
                    
                    {status !== 'completed' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          // For demo purposes, complete with first family member
                          const completerId = familyMembers[0]?.id;
                          if (completerId) {
                            completeInstance(
                              instance.id,
                              completerId,
                              (instance as any).instanceDate,
                              instance.series_id!
                            );
                          }
                        }}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <h4 className="font-medium text-foreground">New Recurring Task System</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Recurring rules stored as single records in task_series table</li>
              <li>Task instances generated dynamically for calendar/list views</li>
              <li>Completing one instance doesn't affect the recurrence rule</li>
              <li>No database clutter from pre-generated future tasks</li>
              <li>Efficient querying and flexible rule modifications</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};