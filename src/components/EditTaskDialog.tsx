import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Calendar, User, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Task, Profile } from '@/types/task';
import { format } from 'date-fns';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { cn } from '@/lib/utils';

interface EditTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
  familyMembers: Profile[];
}

export const EditTaskDialog = ({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdated, 
  familyMembers 
}: EditTaskDialogProps) => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 10,
    assigned_to: 'unassigned',
    assignees: [] as string[],
    due_date: null as Date | null,
    task_group: 'general',
    is_repeating: false,
    recurring_frequency: 'daily',
    recurring_interval: 1,
    recurring_days_of_week: [] as number[],
    recurring_end_date: null as Date | null
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task && open) {
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
        is_repeating: false,
        recurring_frequency: 'daily',
        recurring_interval: 1,
        recurring_days_of_week: [],
        recurring_end_date: null
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    setLoading(true);

    // Update individual task only (recurring tasks have been removed)
    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        points: formData.points,
        assigned_to: formData.assignees.length === 1 ? formData.assignees[0] : null,
        due_date: formData.due_date?.toISOString() || task.due_date,
      };

      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', task.id);

      if (error) throw error;

      // Update task assignees
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', task.id);

      if (deleteError) throw deleteError;

      if (formData.assignees.length > 0) {
        const assigneeData = formData.assignees.map(assigneeProfileId => ({
          task_id: task.id,
          profile_id: assigneeProfileId,
          assigned_by: task.created_by
        }));

        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert(assigneeData);

        if (assigneeError) throw assigneeError;
      }

      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });

      onTaskUpdated();
      onOpenChange(false);
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

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted successfully',
      });

      onTaskUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              min="1"
              max="100"
              value={formData.points}
              onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 10 }))}
              required
            />
          </div>

          <div>
            <Label>Assign To</Label>
            <MultiSelectAssignees
              familyMembers={familyMembers}
              selectedAssignees={formData.assignees}
              onAssigneesChange={(assignees) => 
                setFormData(prev => ({ ...prev, assignees }))
              }
            />
          </div>

          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                due_date: e.target.value ? new Date(e.target.value) : null 
              }))}
            />
          </div>

          <div>
            <Label htmlFor="task_group">Task Group</Label>
            <select
              id="task_group"
              value={formData.task_group}
              onChange={(e) => setFormData(prev => ({ ...prev, task_group: e.target.value }))}
              className="w-full p-2 border border-input rounded-md bg-background"
            >
              <option value="general">General</option>
              <option value="morning">Morning</option>
              <option value="midday">Midday</option>
              <option value="afternoon">Afternoon</option>
            </select>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Task'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};