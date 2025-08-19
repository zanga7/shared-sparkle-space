import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Task, Profile } from '@/types/task';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';

interface EditTaskDialogProps {
  task: Task;
  familyMembers: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
}

export const EditTaskDialog = ({ task, familyMembers, open, onOpenChange, onTaskUpdated }: EditTaskDialogProps) => {
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
  });

  const isRecurringTask = !!task.series_id;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            {isRecurringTask ? 
              'Edit this recurring task. Choose whether to update just this instance or the entire series.' :
              'Edit this task details'
            }
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
              <Label>Assign to</Label>
              <MultiSelectAssignees
                familyMembers={familyMembers}
                selectedAssignees={formData.assignees}
                onAssigneesChange={(assignees) => setFormData({ ...formData, assignees })}
                placeholder="Select assignees..."
              />
            </div>
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