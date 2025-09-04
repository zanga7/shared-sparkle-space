import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, Users, User, Sun, Clock3, Moon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types/task';
import { TaskRecurrenceOptions } from '@/types/recurrence';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';

interface AddTaskDialogProps {
  familyMembers: Profile[];
  familyId: string;
  profileId: string;
  onTaskCreated: () => void;
  selectedDate?: Date | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preselectedMemberId?: string | null;
  preselectedTaskGroup?: string | null;
}

export const AddTaskDialog = ({ 
  familyMembers, 
  familyId, 
  profileId, 
  onTaskCreated, 
  selectedDate, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  preselectedMemberId,
  preselectedTaskGroup
}: AddTaskDialogProps) => {
  const { toast } = useToast();
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
    completion_rule: 'everyone' as 'any_one' | 'everyone',
    task_group: preselectedTaskGroup || 'general',
  });

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
    rotateBetweenMembers: false,
    skipWeekends: false,
    pauseDuringHolidays: false
  });

  // Update due_date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ 
        ...prev, 
        due_date: selectedDate
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

  // Handle preselected task group
  useEffect(() => {
    if (preselectedTaskGroup) {
      setFormData(prev => ({ 
        ...prev, 
        task_group: preselectedTaskGroup
      }));
    }
  }, [preselectedTaskGroup]);

  // Update task group when changed
  const handleTaskGroupChange = (group: string) => {
    setFormData(prev => ({
      ...prev,
      task_group: group
    }));
  };

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
      // Create single task
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        points: formData.points,
        assigned_to: formData.assignees.length === 1 ? formData.assignees[0] : null, // For backward compatibility
        due_date: formData.due_date?.toISOString() || null,
        completion_rule: formData.completion_rule,
        task_group: formData.task_group, // Add the task_group field
        family_id: familyId,
        created_by: profileId,
        // Include recurrence data if enabled - cast to unknown then Json for Supabase
        recurrence_options: recurrenceEnabled ? (taskRecurrenceOptions as unknown as any) : null
      };

      console.log('Creating task with data:', taskData);
      console.log('Form data task_group:', formData.task_group);

      const { data: taskResult, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      // Handle task assignment based on completion rule
      if (formData.assignees.length > 0 && taskResult) {
        if (formData.completion_rule === 'everyone' && formData.assignees.length > 1) {
          // For "everyone" rule with multiple assignees: create separate task instances for each
          const additionalTasks = [];
          for (let i = 1; i < formData.assignees.length; i++) {
            const duplicateTaskData = {
              ...taskData,
              assigned_to: formData.assignees[i], // Single assignee per instance
            };
            additionalTasks.push(duplicateTaskData);
          }

          // Insert additional task instances
          if (additionalTasks.length > 0) {
            const { data: additionalTaskResults, error: additionalError } = await supabase
              .from('tasks')
              .insert(additionalTasks)
              .select('id');

            if (additionalError) {
              throw additionalError;
            }

            // Create single assignee for each task instance (including the original)
            const allTaskIds = [taskResult.id, ...(additionalTaskResults?.map(t => t.id) || [])];
            const assigneeData = allTaskIds.map((taskId, index) => ({
              task_id: taskId,
              profile_id: formData.assignees[index],
              assigned_by: profileId
            }));

            const { error: assigneeError } = await supabase
              .from('task_assignees')
              .insert(assigneeData);

            if (assigneeError) {
              throw assigneeError;
            }
          } else {
            // Single assignee for the original task
            const { error: assigneeError } = await supabase
              .from('task_assignees')
              .insert({
                task_id: taskResult.id,
                profile_id: formData.assignees[0],
                assigned_by: profileId
              });

            if (assigneeError) {
              throw assigneeError;
            }
          }
        } else {
          // For "any_one" rule or single assignee: create assignees for shared task
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
      }

      toast({
        title: 'Success',
        description: 'Task created successfully!',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 10,
        assigned_to: 'unassigned',
        assignees: [],
        due_date: selectedDate || null,
        completion_rule: 'everyone',
        task_group: preselectedTaskGroup || 'general',
      });

      // Reset recurrence
      setRecurrenceEnabled(false);
      setTaskRecurrenceOptions({
        enabled: false,
        rule: {
          frequency: 'daily',
          interval: 1,
          endType: 'never'
        },
        repeatFrom: 'scheduled',
        rotateBetweenMembers: false,
        skipWeekends: false,
        pauseDuringHolidays: false
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
                if (formData.completion_rule === 'any_one') {
                  return ` Completion: First person to finish completes it for everyone. The finisher receives ${formData.points} points.`;
                } else {
                  return ` Completion: Each person (${selectedNames}) must complete their own instance and receives ${formData.points} points.`;
                }
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

          <div className="space-y-2">
            <Label>Task Group</Label>
            <Select value={formData.task_group} onValueChange={handleTaskGroupChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select task group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Morning (until 11 AM)
                  </div>
                </SelectItem>
                <SelectItem value="midday">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    Midday (11 AM - 3 PM)
                  </div>
                </SelectItem>
                <SelectItem value="afternoon">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Afternoon (3 PM onwards)
                  </div>
                </SelectItem>
                <SelectItem value="general">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    General (any time)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Completion Rule - only show when multiple assignees */}
          {formData.assignees.length > 1 && (
            <div className="space-y-3">
              <Label>Completion Rule</Label>
              <RadioGroup 
                value={formData.completion_rule} 
                onValueChange={(value: 'any_one' | 'everyone') => 
                  setFormData({ ...formData, completion_rule: value })
                }
                className="grid grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="any_one" id="any_one" />
                  <div className="flex-1">
                    <Label htmlFor="any_one" className="cursor-pointer flex items-center gap-2 font-medium">
                      <User className="h-4 w-4" />
                      Any one
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      First person to complete it finishes for everyone
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="everyone" id="everyone" />
                  <div className="flex-1">
                    <Label htmlFor="everyone" className="cursor-pointer flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4" />
                      Everyone
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Each person must complete their own instance
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

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

          {/* Recurrence Panel */}
          {formData.due_date && (
            <UnifiedRecurrencePanel
              enabled={recurrenceEnabled}
              onEnabledChange={(enabled) => {
                setRecurrenceEnabled(enabled);
                setTaskRecurrenceOptions(prev => ({ ...prev, enabled }));
              }}
              startDate={formData.due_date}
              type="task"
              taskOptions={taskRecurrenceOptions}
              onTaskOptionsChange={setTaskRecurrenceOptions}
              familyMembers={familyMembers}
              selectedAssignees={formData.assignees}
            />
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