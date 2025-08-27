import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useRecurringTasksSimplified } from '@/hooks/useRecurringTasksSimplified';
import { format, isToday, isPast } from 'date-fns';

interface RecurringTasksSimplifiedProps {
  familyId: string;
  familyMembers: any[];
}

export const RecurringTasksSimplified: React.FC<RecurringTasksSimplifiedProps> = ({
  familyId,
  familyMembers
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Get month boundaries
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
  
  const { 
    taskSeries, 
    tasks, 
    loading, 
    completeTask 
  } = useRecurringTasksSimplified(familyId, { 
    start: monthStart, 
    end: monthEnd 
  });

  // Filter recurring tasks for this period
  const recurringTasks = tasks.filter(task => task.is_repeating && task.series_id);

  const getTaskStatus = (task: any) => {
    const hasCompletions = task.task_completions && task.task_completions.length > 0;
    const dueDate = new Date(task.due_date);
    
    if (hasCompletions) return 'completed';
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'due-today';
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success';
      case 'overdue': return 'bg-destructive/10 text-destructive';
      case 'due-today': return 'bg-warning/10 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatRecurrenceRule = (series: any) => {
    let rule = 'Every ';
    
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
            <Calendar className="h-5 w-5 animate-pulse" />
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
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              >
                Next
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Simplified recurring tasks - real database records, no virtual instances
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Active Series Summary */}
      {taskSeries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {taskSeries.map((series) => {
            const seriesTasks = recurringTasks.filter(t => t.series_id === series.id);
            const completedCount = seriesTasks.filter(t => 
              t.task_completions && t.task_completions.length > 0
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
                      {completedCount}/{seriesTasks.length} completed
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
      )}

      {/* Recurring Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Recurring Tasks ({recurringTasks.length})</CardTitle>
          <CardDescription>
            Generated task records for this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recurringTasks.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <AlertCircle className="h-4 w-4" />
              No recurring tasks for this month
            </div>
          ) : (
            <div className="space-y-3">
              {recurringTasks.map((task) => {
                const status = getTaskStatus(task);
                const assignedMember = familyMembers.find(m => m.id === task.assigned_to);
                const isCompleted = status === 'completed';
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h4>
                        <Badge className={getStatusColor(status)}>
                          {status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Due: {format(new Date(task.due_date!), 'MMM dd')}</span>
                        <span>{task.points} points</span>
                        {assignedMember && (
                          <span>Assigned to: {assignedMember.display_name}</span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            const completerId = familyMembers[0]?.id; // For demo
                            if (completerId) {
                              completeTask(task.id, completerId);
                            }
                          }}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-dashed border-muted">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <h4 className="font-medium text-foreground">Simplified Recurring System</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>One source of truth: actual task records in database</li>
              <li>Generate tasks on-demand for current viewing period</li>
              <li>No complex virtual instances or memory overhead</li>
              <li>Predictable behavior and easier debugging</li>
              <li>Standard task operations work seamlessly</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};