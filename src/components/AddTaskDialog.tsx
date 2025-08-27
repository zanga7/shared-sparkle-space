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
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';

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

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 10,
    due_date: selectedDate || null as Date | null,
    assigned_to: preselectedMemberId || null as string | null,
    completion_rule: 'everyone' as 'any_one' | 'everyone',
    assignees: [] as string[],
    task_group: preselectedTaskGroup || 'general' as string,
  });

  // Update form when preselected values change
  useEffect(() => {
    if (preselectedMemberId) {
      setFormData(prev => ({ 
        ...prev, 
        assigned_to: preselectedMemberId,
        assignees: prev.completion_rule === 'everyone' ? [preselectedMemberId] : []
      }));
    }
    if (preselectedTaskGroup) {
      setFormData(prev => ({ ...prev, task_group: preselectedTaskGroup }));
    }
  }, [preselectedMemberId, preselectedTaskGroup]);

  // Update due date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, due_date: selectedDate }));
    }
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      // Create single task
      const taskData = {
        title: formData.title,
        description: formData.description || null,
        points: formData.points,
        due_date: formData.due_date?.toISOString() || null,
        assigned_to: formData.assigned_to,
        created_by: profileId,
        family_id: familyId,
        completion_rule: formData.completion_rule,
        task_group: formData.task_group,
      };

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) throw taskError;

      // Handle assignees for multi-assignment tasks
      if (formData.completion_rule === 'everyone' && formData.assignees.length > 0) {
        const assigneeData = formData.assignees.map(assigneeId => ({
          task_id: task.id,
          profile_id: assigneeId,
          assigned_by: profileId,
        }));

        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert(assigneeData);

        if (assigneeError) throw assigneeError;
      }

      toast({
        title: 'Task created!',
        description: 'Your task has been created successfully.',
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 10,
        due_date: selectedDate || null,
        assigned_to: preselectedMemberId || null,
        completion_rule: 'everyone',
        assignees: [],
        task_group: preselectedTaskGroup || 'general',
      });

      setOpen(false);
      onTaskCreated();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    setFormData(prev => ({
      ...prev,
      assignees: prev.assignees.includes(assigneeId)
        ? prev.assignees.filter(id => id !== assigneeId)
        : [...prev.assignees, assigneeId]
    }));
  };

  const getTaskGroupIcon = (group: string) => {
    switch (group) {
      case 'morning': return <Sun className="h-4 w-4" />;
      case 'afternoon': return <Clock3 className="h-4 w-4" />;
      case 'evening': return <Moon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task for your family.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
              min="0"
              step="1"
            />
          </div>

          <div>
            <Label>Task Group</Label>
            <Select value={formData.task_group} onValueChange={(value) => setFormData({ ...formData, task_group: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    General
                  </div>
                </SelectItem>
                <SelectItem value="morning">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Morning
                  </div>
                </SelectItem>
                <SelectItem value="afternoon">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    Afternoon
                  </div>
                </SelectItem>
                <SelectItem value="evening">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Evening
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
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
                  {formData.due_date ? format(formData.due_date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date || undefined}
                  onSelect={(date) => setFormData({ ...formData, due_date: date || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {formData.due_date && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, due_date: null })}
                className="mt-1"
              >
                Clear date
              </Button>
            )}
          </div>

          <div>
            <Label>Completion Type</Label>
            <RadioGroup
              value={formData.completion_rule}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                completion_rule: value as 'any_one' | 'everyone',
                assignees: value === 'any_one' ? [] : formData.assignees
              })}
              className="flex space-x-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="any_one" id="any_one" />
                <Label htmlFor="any_one" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Any One Person
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="everyone" id="everyone" />
                <Label htmlFor="everyone" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Everyone Assigned
                </Label>
              </div>
            </RadioGroup>
          </div>

          {formData.completion_rule === 'any_one' && (
            <div>
              <Label>Assigned To</Label>
              <Select value={formData.assigned_to || ''} onValueChange={(value) => setFormData({ ...formData, assigned_to: value || null })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select family member" />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.completion_rule === 'everyone' && (
            <div>
              <Label>Assign To (select multiple)</Label>
              <MultiSelectAssignees
                familyMembers={familyMembers}
                selectedAssignees={formData.assignees}
                onAssigneesChange={(assignees) => setFormData({ ...formData, assignees })}
              />
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim()} className="flex-1">
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};