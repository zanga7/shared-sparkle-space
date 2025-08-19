import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';

interface Profile {
  id: string;
  display_name: string;
  role: 'parent' | 'child';
}

interface AddTaskDialogProps {
  familyMembers: Profile[];
  familyId: string;
  profileId: string;
  onTaskCreated: () => void;
}

export const AddTaskDialog = ({ familyMembers, familyId, profileId, onTaskCreated }: AddTaskDialogProps) => {
  const { toast } = useToast();
  const { createTaskSeries } = useRecurringTasks(familyId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 10,
    assigned_to: 'unassigned',
    due_date: null as Date | null,
    is_repeating: false,
    recurring_frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    recurring_interval: 1,
    recurring_days_of_week: [] as number[],
    recurring_end_date: null as Date | null
  });

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
        });
      } else {
        // Create single task
        const taskData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          points: formData.points,
          assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to,
          due_date: formData.due_date?.toISOString() || null,
          is_repeating: false,
          family_id: familyId,
          created_by: profileId
        };

        const { error } = await supabase
          .from('tasks')
          .insert(taskData);

        if (error) {
          throw error;
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
        due_date: null,
        is_repeating: false,
        recurring_frequency: 'daily',
        recurring_interval: 1,
        recurring_days_of_week: [],
        recurring_end_date: null
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
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new chore or activity for your family
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
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Anyone can do it" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Anyone can do it</SelectItem>
                  {familyMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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

          <div className="flex items-center space-x-2">
            <Switch
              id="repeating"
              checked={formData.is_repeating}
              onCheckedChange={(checked) => setFormData({ ...formData, is_repeating: checked })}
            />
            <Label htmlFor="repeating">Repeating task</Label>
          </div>

          {/* Recurring options - shown when is_repeating is true */}
          {formData.is_repeating && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium text-sm">Recurring Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select 
                    value={formData.recurring_frequency}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                      setFormData({ ...formData, recurring_frequency: value, recurring_days_of_week: [] })
                    }
                  >
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
                  <Label htmlFor="interval">Every</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.recurring_interval}
                    onChange={(e) => setFormData({ ...formData, recurring_interval: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                  />
                </div>
              </div>
              
              {formData.recurring_frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                      const dayNumber = index === 6 ? 0 : index + 1; // Sunday = 0, Monday = 1, etc.
                      const isSelected = formData.recurring_days_of_week.includes(dayNumber);
                      return (
                        <Button 
                          key={day} 
                          type="button" 
                          variant={isSelected ? "default" : "outline"} 
                          size="sm" 
                          className="text-xs"
                          onClick={() => {
                            const newDays = isSelected 
                              ? formData.recurring_days_of_week.filter(d => d !== dayNumber)
                              : [...formData.recurring_days_of_week, dayNumber].sort();
                            setFormData({ ...formData, recurring_days_of_week: newDays });
                          }}
                        >
                          {day}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
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
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
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