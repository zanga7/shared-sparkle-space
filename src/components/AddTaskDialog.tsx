import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { Profile } from '@/types/task';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { RecurringOptionsForm } from '@/components/RecurringOptionsForm';

interface AddTaskDialogProps {
  familyMembers: Profile[];
  familyId: string;
  profileId: string;
  onTaskCreated: () => void;
  selectedDate?: Date | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preselectedMemberId?: string | null;
}

export const AddTaskDialog = ({ 
  familyMembers, 
  familyId, 
  profileId, 
  onTaskCreated, 
  selectedDate, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  preselectedMemberId
}: AddTaskDialogProps) => {
  const { toast } = useToast();
  const { createTaskSeries } = useRecurringTasks(familyId);
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Use external open state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  
  // Initialize form data with selectedDate if provided
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 10,
    assigned_to: 'unassigned',
    assignees: [] as string[],
    due_date: selectedDate || null,
    is_repeating: false,
    recurring_frequency: 'weekly',
    recurring_interval: 1,
    recurring_days_of_week: [] as number[],
    recurring_end_date: null as Date | null,
    start_date: (selectedDate || new Date()).toISOString(),
    repetition_count: null as number | null,
    monthly_type: 'date' as 'date' | 'weekday',
    monthly_weekday_ordinal: 1,
  });

  // Update due_date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ 
        ...prev, 
        due_date: selectedDate,
        start_date: selectedDate.toISOString()
      }));
    }
  }, [selectedDate]);

  // Handle preselected member
  useEffect(() => {
    if (preselectedMemberId && preselectedMemberId !== 'unassigned') {
      setFormData(prev => ({ 
        ...prev, 
        assigned_to: preselectedMemberId,
        assignees: [preselectedMemberId]
      }));
    } else if (preselectedMemberId === 'unassigned') {
      setFormData(prev => ({ 
        ...prev, 
        assigned_to: 'unassigned',
        assignees: []
      }));
    }
  }, [preselectedMemberId]);

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
      if (formData.is_repeating) {
        // Create recurring task series
        await createTaskSeries({
          family_id: familyId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          points: formData.points,
          assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
          created_by: profileId,
          recurring_frequency: formData.recurring_frequency,
          recurring_interval: formData.recurring_interval,
          recurring_days_of_week: formData.recurring_frequency === 'weekly' 
            ? formData.recurring_days_of_week : null,
          recurring_end_date: formData.recurring_end_date?.toISOString() || null,
          start_date: formData.start_date,
          repetition_count: formData.repetition_count,
          remaining_repetitions: formData.repetition_count,
          monthly_type: formData.monthly_type,
          monthly_weekday_ordinal: formData.monthly_weekday_ordinal,
        });
      } else {
        // Create single task
        const taskData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          points: formData.points,
          assigned_to: formData.assignees.length === 1 ? formData.assignees[0] : null, // For backward compatibility
          due_date: formData.due_date?.toISOString() || null,
          is_repeating: false,
          family_id: familyId,
          created_by: profileId
        };

        const { data: taskResult, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        // Insert task assignees if any are selected
        if (formData.assignees.length > 0 && taskResult) {
          const assigneeData = formData.assignees.map(assigneeProfileId => ({
            task_id: taskResult.id,
            profile_id: assigneeProfileId,
            assigned_by: profileId
          }));

          const { error: assigneeError } = await supabase
            .from('task_assignees')
            .insert(assigneeData);

          if (assigneeError) {
            throw assigneeError;
          }
        }

        toast({
          title: 'Success',
          description: 'Task created successfully!',
        });
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 10,
        assigned_to: 'unassigned',
        assignees: [],
        due_date: selectedDate || null,
        is_repeating: false,
        recurring_frequency: 'weekly',
        recurring_interval: 1,
        recurring_days_of_week: [],
        recurring_end_date: null,
        start_date: (selectedDate || new Date()).toISOString(),
        repetition_count: null,
        monthly_type: 'date',
        monthly_weekday_ordinal: 1,
      });

      setOpen(false);
      onTaskCreated();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only show trigger if not externally controlled */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {selectedDate ? `Create Task for ${format(selectedDate, 'MMM d, yyyy')}` : 'Create New Task'}
          </DialogTitle>
          <DialogDescription>
            Add a new chore or activity for your family.
            {(() => {
              if (formData.assignees.length > 1) {
                const selectedNames = familyMembers
                  .filter(m => formData.assignees.includes(m.id))
                  .map(m => m.display_name)
                  .join(', ');
                return ` When completed, all assigned members (${selectedNames}) will receive ${formData.points} points each.`;
              } else if (formData.assignees.length === 1) {
                const assignee = familyMembers.find(m => m.id === formData.assignees[0]);
                return ` When completed, ${assignee?.display_name} will receive ${formData.points} points.`;
              } else {
                return ` When completed, whoever finishes this task will receive ${formData.points} points.`;
              }
            })()}
          </DialogDescription>
        </DialogHeader>
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

          {!formData.is_repeating && (
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

          <div className="flex items-center space-x-2">
            <Switch
              id="repeating"
              checked={formData.is_repeating}
              onCheckedChange={(checked) => setFormData({ ...formData, is_repeating: checked })}
            />
            <Label htmlFor="repeating">Repeating task</Label>
          </div>

          {/* Enhanced Recurring Options */}
          {formData.is_repeating && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Repeat className="h-4 w-4" />
                Recurring Options
              </div>

              <RecurringOptionsForm
                formData={{
                  recurring_frequency: formData.recurring_frequency,
                  recurring_interval: formData.recurring_interval,
                  recurring_days_of_week: formData.recurring_days_of_week,
                  recurring_end_date: formData.recurring_end_date?.toISOString() || '',
                  start_date: formData.start_date,
                  repetition_count: formData.repetition_count,
                  monthly_type: formData.monthly_type,
                  monthly_weekday_ordinal: formData.monthly_weekday_ordinal,
                }}
                onChange={(field, value) => {
                  if (field === 'recurring_end_date') {
                    setFormData(prev => ({ ...prev, recurring_end_date: value ? new Date(value) : null }));
                  } else {
                    setFormData(prev => ({ ...prev, [field]: value }));
                  }
                }}
                selectedDate={formData.due_date}
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};