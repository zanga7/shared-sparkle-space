import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  Calendar, 
  Target, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  User
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { useToast } from '@/hooks/use-toast';
import { Profile, Task, TaskSeries } from '@/types/task';

interface RecurringSeriesDialogProps {
  series: TaskSeries;
  tasks: Task[];
  familyMembers: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSeriesUpdated: () => void;
}

export const RecurringSeriesDialog = ({ 
  series, 
  tasks, 
  familyMembers, 
  open, 
  onOpenChange, 
  onSeriesUpdated 
}: RecurringSeriesDialogProps) => {
  const { updateTaskSeries, deactivateTaskSeries } = useRecurringTasks(series?.family_id);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const seriesTasks = tasks.filter(task => task.series_id === series.id);
  const completedTasks = seriesTasks.filter(task => 
    task.task_completions && task.task_completions.length > 0
  );
  const completionRate = seriesTasks.length > 0 ? 
    Math.round((completedTasks.length / seriesTasks.length) * 100) : 0;

  // Calculate streak (consecutive completed tasks)
  const calculateStreak = () => {
    const sortedTasks = seriesTasks
      .filter(task => task.due_date)
      .sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime());
    
    let streak = 0;
    for (const task of sortedTasks) {
      const isCompleted = task.task_completions && task.task_completions.length > 0;
      if (isCompleted) {
        streak++;
      } else if (task.due_date && new Date(task.due_date) <= new Date()) {
        // If past due and not completed, streak breaks
        break;
      }
    }
    return streak;
  };

  const calculateNextDueDate = () => {
    if (!series.is_active || !series.last_generated_date) return null;
    
    const lastDate = new Date(series.last_generated_date);
    
    switch (series.recurring_frequency) {
      case 'daily':
        return addDays(lastDate, series.recurring_interval);
      case 'weekly':
        return addWeeks(lastDate, series.recurring_interval);
      case 'monthly':
        return addMonths(lastDate, series.recurring_interval);
      default:
        return null;
    }
  };

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      if (series.is_active) {
        await deactivateTaskSeries(series.id);
        toast({
          title: 'Series Paused',
          description: 'No new tasks will be generated',
        });
      } else {
        await updateTaskSeries(series.id, { is_active: true });
        toast({
          title: 'Series Resumed', 
          description: 'Task generation will continue',
        });
      }
      onSeriesUpdated();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setLoading(false);
    }
  };

  const assignedMember = familyMembers.find(member => member.id === series.assigned_to);
  const streak = calculateStreak();
  const nextDue = calculateNextDueDate();
  const frequencyText = `Every ${series.recurring_interval} ${series.recurring_frequency}${series.recurring_interval > 1 ? 's' : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Recurring Series: {series.title}
          </DialogTitle>
          <DialogDescription>
            Manage this recurring task series and view its progress
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Series Status & Controls */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Series Status</CardTitle>
                <Badge variant={series.is_active ? "default" : "secondary"}>
                  {series.is_active ? "Active" : "Paused"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {series.is_active ? (
                      <Play className="h-4 w-4 text-green-500" />
                    ) : (
                      <Pause className="h-4 w-4 text-orange-500" />
                    )}
                    <Label htmlFor="active-toggle">
                      {series.is_active ? "Running" : "Paused"}
                    </Label>
                  </div>
                </div>
                <Switch
                  id="active-toggle"
                  checked={series.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={loading}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{frequencyText}</span>
                </div>
                {assignedMember && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{assignedMember.display_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span>{series.points} points each</span>
                </div>
                {nextDue && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Next: {format(nextDue, "MMM d")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{seriesTasks.length}</div>
                  <div className="text-sm text-muted-foreground">Tasks Generated</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{completionRate}%</div>
                  <div className="text-sm text-muted-foreground">Completion Rate</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">{streak}</div>
                  <div className="text-sm text-muted-foreground">Current Streak</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recent Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {seriesTasks
                  .filter(task => task.due_date)
                  .sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime())
                  .slice(0, 5)
                  .map((task) => {
                    const isCompleted = task.task_completions && task.task_completions.length > 0;
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
                    
                    return (
                      <div key={task.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`h-4 w-4 ${isCompleted ? 'text-green-500' : 'text-muted-foreground'}`} />
                          <span className={isCompleted ? 'line-through text-muted-foreground' : ''}>
                            Due {format(new Date(task.due_date!), "MMM d")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted && <Badge variant="default" className="text-xs bg-green-500">Completed</Badge>}
                          {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                          <span className="text-sm text-muted-foreground">{series.points}pts</span>
                        </div>
                      </div>
                    );
                  })}
                
                {seriesTasks.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No tasks generated yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};