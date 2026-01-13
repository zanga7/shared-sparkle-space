import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Calendar, User, Users, Repeat, RotateCcw } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Task, Profile } from '@/types/task';
import { TaskRecurrenceOptions } from '@/types/recurrence';
import { format } from 'date-fns';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';
import { cn } from '@/lib/utils';
import { useTaskSeries } from '@/hooks/useTaskSeries';
import { EditScopeDialog, EditScope } from '@/components/recurrence/EditScopeDialog';

interface EditTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated: () => void;
  familyMembers: Profile[];
  familyId: string;
}

export const EditTaskDialog = ({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdated, 
  familyMembers,
  familyId 
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
    completion_rule: 'everyone' as 'any_one' | 'everyone'
  });
  
  const [loading, setLoading] = useState(false);
  
  // Recurrence state
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [taskRecurrenceOptions, setTaskRecurrenceOptions] = useState<TaskRecurrenceOptions>({
    enabled: false,
    rule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never'
    },
    repeatFrom: 'scheduled',
    skipWeekends: false,
    pauseDuringHolidays: false,
    rotateBetweenMembers: false
  });

  // Edit scope state for recurring tasks
  const [editScopeDialogOpen, setEditScopeDialogOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<any>(null);
  
  const { createTaskException, updateTaskSeries, splitTaskSeries } = useTaskSeries(
    familyMembers.find(m => m.id === task.created_by)?.family_id
  );

  // Load form state when dialog opens
  useEffect(() => {
    const loadTaskData = async () => {
      if (!task || !open) return;

      // Resolve assignees robustly:
      // - For virtual recurring tasks, the authoritative assignee list lives on task_series.assigned_profiles
      // - For regular tasks, it lives on task_assignees
      let currentAssignees: string[] = [];
      let resolvedCompletionRule: 'any_one' | 'everyone' = (task.completion_rule || 'everyone') as 'any_one' | 'everyone';

      const isVirtualSeriesTask = Boolean((task as any).isVirtual && (task as any).series_id);

      if (isVirtualSeriesTask) {
        try {
          const seriesId = (task as any).series_id as string;
          const { data: series, error: seriesError } = await supabase
            .from('task_series')
            .select('assigned_profiles, completion_rule')
            .eq('id', seriesId)
            .maybeSingle();

          if (seriesError) throw seriesError;

          if (series?.assigned_profiles && series.assigned_profiles.length > 0) {
            currentAssignees = series.assigned_profiles;
          } else {
            // Fallback to the virtual instance payload (may be member-specific)
            currentAssignees =
              task.assignees?.map((a) => a.profile_id) ||
              (task.assigned_to ? [task.assigned_to] : []);
          }

          if (series?.completion_rule) {
            resolvedCompletionRule = series.completion_rule as 'any_one' | 'everyone';
          }
        } catch (error) {
          console.error('Error fetching task series data:', error);
          currentAssignees =
            task.assignees?.map((a) => a.profile_id) ||
            (task.assigned_to ? [task.assigned_to] : []);
        }
      } else if (!(task as any).isVirtual) {
        // Non-virtual task: load assignees from task_assignees
        try {
          const { data: assigneeData, error: assigneeError } = await supabase
            .from('task_assignees')
            .select('profile_id')
            .eq('task_id', task.id);

          if (assigneeError) throw assigneeError;

          if (assigneeData && assigneeData.length > 0) {
            currentAssignees = assigneeData.map((a) => a.profile_id);
          } else if (task.assigned_to) {
            currentAssignees = [task.assigned_to];
          }
        } catch (error) {
          console.error('Error fetching task assignees:', error);
          currentAssignees =
            task.assignees?.map((a) => a.profile_id) ||
            (task.assigned_to ? [task.assigned_to] : []);
        }
      } else {
        // Virtual task without series context: use payload
        currentAssignees =
          task.assignees?.map((a) => a.profile_id) ||
          (task.assigned_to ? [task.assigned_to] : []);
      }

      setFormData({
        title: task.title,
        description: task.description || '',
        points: task.points,
        assigned_to: task.assigned_to || 'unassigned',
        assignees: currentAssignees,
        due_date: task.due_date ? new Date(task.due_date) : null,
        task_group: (task as any).task_group || 'general',
        completion_rule: resolvedCompletionRule,
      });

      // Load existing recurrence options
      const hasRecurrence = task.recurrence_options && task.recurrence_options.enabled;
      setRecurrenceEnabled(hasRecurrence || false);
      
      if (hasRecurrence && task.recurrence_options) {
        setTaskRecurrenceOptions(task.recurrence_options);
      } else {
        // Reset to default
        setTaskRecurrenceOptions({
          enabled: false,
          rule: {
            frequency: 'daily',
            interval: 1,
            endType: 'never'
          },
          repeatFrom: 'scheduled',
          skipWeekends: false,
          pauseDuringHolidays: false,
          rotateBetweenMembers: false
        });
      }
    };
    
    loadTaskData();
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    // Require at least one assignee
    if (formData.assignees.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one assignee is required',
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);

    try {
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        points: formData.points,
        task_group: formData.task_group,
        assignees: formData.assignees,
        due_date: formData.due_date,
        completion_rule: formData.completion_rule,
        recurrence_options: recurrenceEnabled ? taskRecurrenceOptions : null
      };

      // Check if this is a virtual task from a series
      if ((task as any).isVirtual && (task as any).series_id) {
        // Show edit scope dialog for recurring tasks
        setPendingSave(updateData);
        setEditScopeDialogOpen(true);
        return;
      }

      // Check if this is a rotating task - update the rotating_tasks table instead
      if (task.rotating_task_id) {
        await updateRotatingTask(updateData);
      } else {
        // Regular task update
        await updateRegularTask(updateData);
      }
      
      toast({
        title: 'Success',
        description: task.rotating_task_id ? 'Rotating task updated successfully' : 'Task updated successfully',
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

  const updateRegularTask = async (updateData: any) => {
    const taskData = {
      title: updateData.title,
      description: updateData.description,
      points: updateData.points,
      assigned_to: updateData.assignees.length === 1 ? updateData.assignees[0] : null,
      due_date: updateData.due_date ? updateData.due_date.toISOString() : null,
      task_group: updateData.task_group,
      completion_rule: updateData.completion_rule,
      recurrence_options: updateData.recurrence_options ? {
        ...updateData.recurrence_options,
        enabled: true
      } as any : null
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

    if (updateData.assignees.length > 0) {
      const assigneeData = updateData.assignees.map(assigneeProfileId => ({
        task_id: task.id,
        profile_id: assigneeProfileId,
        assigned_by: task.created_by
      }));

      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert(assigneeData);

      if (assigneeError) throw assigneeError;
    }
  };

  const updateRotatingTask = async (updateData: any) => {
    // Update the rotating_tasks table with the new values
    const { error } = await supabase
      .from('rotating_tasks')
      .update({
        name: updateData.title,
        description: updateData.description,
        points: updateData.points,
        task_group: updateData.task_group,
      })
      .eq('id', task.rotating_task_id);

    if (error) throw error;

    // Also update the current task instance in the tasks table
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        title: updateData.title,
        description: updateData.description,
        points: updateData.points,
        task_group: updateData.task_group,
      })
      .eq('id', task.id);

    if (taskError) throw taskError;
  };

  const handleEditScopeSelect = async (scope: EditScope) => {
    if (!pendingSave) return;

    const virtualTask = task as any;
    if (!virtualTask.series_id || !virtualTask.occurrence_date) {
      console.error('Missing series information for edit scope');
      return;
    }

    try {
      switch (scope) {
        case 'this_only':
          // Create an exception for this specific occurrence
          await createTaskException({
            series_id: virtualTask.series_id,
            exception_date: virtualTask.occurrence_date,
            exception_type: 'override',
            override_data: pendingSave,
            created_by: task.created_by
          });
          toast({
            title: 'Success',
            description: 'This occurrence updated successfully',
          });
          break;

        case 'this_and_following':
          // Split the series at this occurrence
          const splitDate = new Date(virtualTask.due_date);
          await splitTaskSeries(
            virtualTask.series_id,
            splitDate,
            {
              title: pendingSave.title,
              description: pendingSave.description,
              points: pendingSave.points,
              task_group: pendingSave.task_group,
              completion_rule: task.completion_rule,
              assigned_profiles: pendingSave.assignees || [],
              family_id: familyId,
              created_by: task.created_by,
              recurrence_rule: taskRecurrenceOptions.rule,
              is_active: true
            }
          );
          toast({
            title: 'Success',
            description: 'Series split and updated from this occurrence forward',
          });
          break;

        case 'all_occurrences':
          // Update the entire series
          await updateTaskSeries(virtualTask.series_id, {
            title: pendingSave.title,
            description: pendingSave.description,
            points: pendingSave.points,
            task_group: pendingSave.task_group,
            assigned_profiles: pendingSave.assignees || [],
            recurrence_rule: taskRecurrenceOptions.rule
          });
          toast({
            title: 'Success',
            description: 'All occurrences in the series updated',
          });
          break;
      }

      onTaskUpdated();
      // Notify listeners (e.g., dashboards) that series data changed
      try { window.dispatchEvent(new CustomEvent('series-updated')); } catch {}
      onOpenChange(false);
    } catch (error) {
      console.error('Error handling edit scope:', error);
      toast({
        title: 'Error',
        description: 'Failed to save task changes',
        variant: 'destructive'
      });
    } finally {
      setPendingSave(null);
    }
  };

  const handleDelete = async () => {
    // Check if this is a virtual task from a series
    if ((task as any).isVirtual && (task as any).series_id) {
      if (!window.confirm('Are you sure you want to skip this occurrence?')) return;
      
      try {
        await createTaskException({
          series_id: (task as any).series_id,
          exception_date: (task as any).occurrence_date,
          exception_type: 'skip',
          created_by: task.created_by
        });
        
        toast({
          title: 'Task Skipped',
          description: 'This occurrence has been skipped',
        });
        // Notify listeners that series data changed
        try { window.dispatchEvent(new CustomEvent('series-updated')); } catch {}
        
        onTaskUpdated();
        onOpenChange(false);
        return;
      } catch (error) {
        console.error('Error skipping task occurrence:', error);
        toast({
          title: 'Error',
          description: 'Failed to skip task occurrence',
          variant: 'destructive'
        });
        return;
      }
    }
    
    // Regular task deletion
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

  // Determine if this is a group task (multiple assignees OR everyone completion rule)
  const isGroupTask = formData.assignees.length > 1 || task.completion_rule === 'everyone';
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Task
              {(task as any).isVirtual && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Repeat className="h-3 w-3 mr-1" />
                  Recurring
                </Badge>
              )}
              {task.rotating_task_id && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Rotating
                </Badge>
              )}
              {isGroupTask && !task.rotating_task_id && !(task as any).isVirtual && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Group Task
                </Badge>
              )}
            </DialogTitle>
            {(task as any).isVirtual && (
              <p className="text-sm text-muted-foreground">
                This is a recurring task. Changes will show edit scope options.
              </p>
            )}
            {task.rotating_task_id && (
              <p className="text-sm text-muted-foreground">
                This is a rotating task. Changes will update the rotation settings.
              </p>
            )}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
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
                onKeyDown={(e) => {
                  // Allow Shift+Enter for new lines, plain Enter submits form
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
                required
              />
            </div>

            {/* Hide assignee selection for rotating tasks - managed via rotation settings */}
            {!task.rotating_task_id && (
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
            )}

            {/* Due date handling:
                - Rotating tasks: managed by cadence settings
                - Virtual recurring tasks: show occurrence date (read-only) + optional due date (editable)
                - Regular tasks: optional and removable due date
            */}
            {!task.rotating_task_id && (
              <div className="space-y-3">
                {/* For virtual/recurring tasks, show the occurrence date separately */}
                {(task as any).isVirtual && (task as any).occurrence_date && (
                  <div>
                    <Label>Occurrence Date</Label>
                    <Input
                      type="date"
                      value={(task as any).occurrence_date}
                      disabled
                      className="flex-1 bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      When this instance appears (from recurrence schedule)
                    </p>
                  </div>
                )}
                
                {/* Due date is always optional and editable for all task types */}
                <div>
                  <Label htmlFor="due_date">Due Date (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : ''}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          due_date: e.target.value ? new Date(e.target.value) : null
                        }))
                      }
                      className="flex-1"
                    />
                    {formData.due_date && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData(prev => ({ ...prev, due_date: null }))}
                        title="Clear due date"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional deadline for when this task should be completed
                  </p>
                </div>
              </div>
            )}

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
                <option value="evening">Evening</option>
              </select>
            </div>

            {/* Completion Rule - show when multiple assignees OR task/series already has completion_rule set, and not a rotating task */}
            {(formData.assignees.length > 1 || task.completion_rule === 'everyone' || task.completion_rule === 'any_one' || formData.completion_rule === 'everyone' || formData.completion_rule === 'any_one') && !task.rotating_task_id && (
              <div className="space-y-3">
                <Label>Completion Rule</Label>
                <RadioGroup 
                  value={formData.completion_rule} 
                  onValueChange={(value: 'any_one' | 'everyone') => 
                    setFormData(prev => ({ ...prev, completion_rule: value }))
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="any_one" id="edit_any_one" />
                    <div className="flex-1">
                      <Label htmlFor="edit_any_one" className="cursor-pointer flex items-center gap-2 font-medium">
                        <User className="h-4 w-4" />
                        Any one
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        First to complete finishes for all
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="everyone" id="edit_everyone" />
                    <div className="flex-1">
                      <Label htmlFor="edit_everyone" className="cursor-pointer flex items-center gap-2 font-medium">
                        <Users className="h-4 w-4" />
                        Everyone
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each person completes independently
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Recurrence Options - hide for rotating tasks */}
            {!task.rotating_task_id && (
              <>
                {(task as any).isVirtual && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-dashed mb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Repeat className="h-4 w-4" />
                      <span>This is a recurring task from a series. Changes to recurrence will prompt you to choose which occurrences to update.</span>
                    </div>
                  </div>
                )}
                <UnifiedRecurrencePanel
                  type="task"
                  enabled={recurrenceEnabled}
                  onEnabledChange={setRecurrenceEnabled}
                  startDate={formData.due_date || new Date()}
                  taskOptions={taskRecurrenceOptions}
                  onTaskOptionsChange={setTaskRecurrenceOptions}
                  familyMembers={familyMembers}
                  selectedAssignees={formData.assignees}
                />
              </>
            )}

            {/* Info for rotating tasks about what can be edited */}
            {task.rotating_task_id && (
              <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCcw className="h-4 w-4" />
                  <span>Rotation schedule and member order are managed in Admin → Rotating Tasks.</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {(task as any).isVirtual ? 'Skip' : 'Delete'}
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
      
      <EditScopeDialog
        open={editScopeDialogOpen}
        onOpenChange={setEditScopeDialogOpen}
        onScopeSelect={handleEditScopeSelect}
        itemType="task"
        occurrenceDate={task.due_date ? new Date(task.due_date) : undefined}
      />
    </>
  );
};