import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Task, Profile } from '@/types/task';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { Switch } from '@/components/ui/switch';

interface EditTaskDialogProps {
  task: Task;
  familyMembers: Profile[];
  profile?: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
}

export const EditTaskDialog = ({ task, familyMembers, profile, open, onOpenChange, onTaskUpdated }: EditTaskDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editScope, setEditScope] = useState<'single' | 'series'>('single');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 10,
    assigned_to: 'unassigned',
    assignees: [] as string[],
    due_date: null as Date | null,
    task_group: 'general' as string,
    is_repeating: false,
    recurring_frequency: 'daily' as string,
    recurring_interval: 1,
    recurring_days_of_week: [] as number[],
    recurring_end_date: null as Date | null,
  });

  const isRecurringTask = !!task.series_id;
  const isCompleted = task.task_completions && task.task_completions.length > 0;

  useEffect(() => {
    if (task) {
      // Get current assignees from the task
      const currentAssignees = task.assignees?.map(a => a.profile_id) || 
                              (task.assigned_to ? [task.assigned_to] : []);
      
      setFormData({
        title: task.title,
        description: task.description || '',
        points: task.points,
        assigned_to: task.assigned_to || 'unassigned',
        assignees: currentAssignees,
        due_date: task.due_date ? new Date(task.due_date) : null,
        task_group: (task as any).task_group || 'general',
        is_repeating: task.is_repeating || false,
        recurring_frequency: task.recurring_frequency || 'daily',
        recurring_interval: task.recurring_interval || 1,
        recurring_days_of_week: task.recurring_days_of_week || [],
        recurring_end_date: task.recurring_end_date ? new Date(task.recurring_end_date) : null,
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Task title is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      if (isRecurringTask && editScope === 'series') {
        // Update the task series for all future tasks
        const { error: seriesError } = await supabase
          .from('task_series')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            points: formData.points,
            assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
          })
          .eq('id', task.series_id);

        if (seriesError) throw seriesError;

        // Update all future incomplete tasks in the series
        const { error: tasksError } = await supabase
          .from('tasks')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            points: formData.points,
            assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
          })
          .eq('series_id', task.series_id)
          .is('task_completions', null); // Only update uncompleted tasks

        if (tasksError) throw tasksError;

        toast({
          title: 'Success',
          description: 'Series updated - all future tasks will use these settings',
        });
      } else {
        // Update just this single task
        const taskData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          points: formData.points,
          assigned_to: formData.assignees.length === 1 ? formData.assignees[0] : null, // For backward compatibility
          due_date: formData.due_date?.toISOString() || task.due_date,
        };

        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;

        // Update task assignees - first delete existing ones, then add new ones
        const { error: deleteError } = await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', task.id);

        if (deleteError) throw deleteError;

        // Insert new assignees if any are selected
        if (formData.assignees.length > 0) {
          const assigneeData = formData.assignees.map(assigneeProfileId => ({
            task_id: task.id,
            profile_id: assigneeProfileId,
            assigned_by: task.created_by // Use the task creator as the assigner
          }));

          const { error: assigneeError } = await supabase
            .from('task_assignees')
            .insert(assigneeData);

          if (assigneeError) throw assigneeError;
        }

        toast({
          title: 'Success',
          description: isRecurringTask ? 'This task instance updated' : 'Task updated successfully',
        });
      }

      onOpenChange(false);
      onTaskUpdated();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = async () => {
    if (!profile) return;
    
    try {
      if (isCompleted) {
        // Uncomplete task
        const userCompletion = task.task_completions?.find(completion => completion.completed_by === profile.id);
        if (!userCompletion) return;

        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('id', userCompletion.id);

        if (error) throw error;

        // Remove points
        const assignees = task.assignees?.map(a => a.profile) || 
                         (task.assigned_profile ? [task.assigned_profile] : [profile]);

        const pointUpdates = assignees.map(async (recipient) => {
          const currentProfile = familyMembers.find(m => m.id === recipient.id);
          if (currentProfile) {
            return supabase
              .from('profiles')
              .update({
                total_points: currentProfile.total_points - task.points
              })
              .eq('id', recipient.id);
          }
        });

        await Promise.all(pointUpdates.filter(Boolean));

        toast({
          title: 'Task Uncompleted',
          description: `${task.points} points removed`,
        });
      } else {
        // Complete task
        const { error } = await supabase
          .from('task_completions')
          .insert({
            task_id: task.id,
            completed_by: profile.id,
            points_earned: task.points
          });

        if (error) throw error;

        // Award points
        const assignees = task.assignees?.map(a => a.profile) || 
                         (task.assigned_profile ? [task.assigned_profile] : []);
        const pointRecipients = assignees.length > 0 ? assignees : [profile];

        const pointUpdates = pointRecipients.map(async (recipient) => {
          const currentProfile = familyMembers.find(m => m.id === recipient.id);
          if (currentProfile) {
            return supabase
              .from('profiles')
              .update({
                total_points: currentProfile.total_points + task.points
              })
              .eq('id', recipient.id);
          }
        });

        await Promise.all(pointUpdates.filter(Boolean));

        let toastMessage;
        if (pointRecipients.length === 1 && pointRecipients[0].id === profile.id) {
          toastMessage = `You earned ${task.points} points!`;
        } else if (pointRecipients.length === 1) {
          toastMessage = `${pointRecipients[0].display_name} earned ${task.points} points!`;
        } else {
          const names = pointRecipients.map(p => p.display_name).join(', ');
          toastMessage = `${task.points} points awarded to: ${names}`;
        }

        toast({
          title: 'Task Completed!',
          description: toastMessage,
        });
      }

      onTaskUpdated();
    } catch (error) {
      console.error('Error toggling task completion:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task completion',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                {(() => {
                  const assignees = task.assignees?.map(a => a.profile) || 
                                   (task.assigned_profile ? [task.assigned_profile] : []);
                  if (assignees.length > 1) {
                    const names = assignees.map(a => a.display_name).join(', ');
                    return `When completed, all assigned members (${names}) will receive ${task.points} points each.`;
                  } else if (assignees.length === 1) {
                    return `When completed, ${assignees[0].display_name} will receive ${task.points} points.`;
                  } else {
                    return `When completed, whoever finishes this task will receive ${task.points} points.`;
                  }
                })()}
              </DialogDescription>
        </DialogHeader>

        {/* Recurring Task Edit Scope Selection */}
        {isRecurringTask && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3 mt-2">
                <p className="font-medium">This is a recurring task. What would you like to edit?</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="edit-single"
                      name="edit-scope"
                      value="single"
                      checked={editScope === 'single'}
                      onChange={(e) => setEditScope(e.target.value as 'single' | 'series')}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="edit-single" className="text-sm">
                      Edit only this task instance (due {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'today'})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="edit-series"
                      name="edit-scope"
                      value="series"
                      checked={editScope === 'series'}
                      onChange={(e) => setEditScope(e.target.value as 'single' | 'series')}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="edit-series" className="text-sm">
                      Edit the entire recurring series (affects all future tasks)
                    </Label>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Clean bedroom, Take out trash"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about the task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min="1"
                max="100"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 10 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Task Group</Label>
              <Select value={formData.task_group || 'general'} onValueChange={(value) => setFormData({ ...formData, task_group: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">🌅 Morning</SelectItem>
                  <SelectItem value="midday">☀️ Midday</SelectItem>
                  <SelectItem value="afternoon">🌆 Afternoon</SelectItem>
                  <SelectItem value="general">📋 General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <MultiSelectAssignees
              familyMembers={familyMembers}
              selectedAssignees={formData.assignees}
              onAssigneesChange={(assignees) => setFormData({ ...formData, assignees })}
              placeholder="Select assignees..."
            />
          </div>

          {/* Only show due date for single task edits or non-recurring tasks */}
          {(!isRecurringTask || editScope === 'single') && (
            <div className="space-y-2">
              <Label>Due Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP") : "No due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => setFormData({ ...formData, due_date: date || null })}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Recurring Task Settings - only for new recurring tasks or series edits */}
          {(!isRecurringTask || editScope === 'series') && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="is-repeating">Make this a recurring task</Label>
                <Switch
                  id="is-repeating"
                  checked={formData.is_repeating}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_repeating: checked })}
                />
              </div>
              
              {formData.is_repeating && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select value={formData.recurring_frequency} onValueChange={(value) => setFormData({ ...formData, recurring_frequency: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Every</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.recurring_interval}
                        onChange={(e) => setFormData({ ...formData, recurring_interval: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.recurring_end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.recurring_end_date ? format(formData.recurring_end_date, "PPP") : "No end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.recurring_end_date}
                          onSelect={(date) => setFormData({ ...formData, recurring_end_date: date || null })}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task Completion Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className={cn(
                "h-5 w-5",
                isCompleted ? "text-green-500" : "text-muted-foreground"
              )} />
              <div>
                <Label className="text-sm font-medium">
                  {isCompleted ? 'Task Completed' : 'Mark as Complete'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isCompleted 
                    ? `${task.points} points have been awarded` 
                    : `Complete this task to earn ${task.points} points`
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={isCompleted}
              onCheckedChange={toggleTaskCompletion}
              disabled={!profile}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 
                isRecurringTask && editScope === 'series' ? 'Update Series' : 'Update Task'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};