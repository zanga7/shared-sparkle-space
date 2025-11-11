import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Trash2 } from "lucide-react";

interface RotatingTask {
  id: string;
  name: string;
  description: string | null;
  points: number;
  cadence: 'daily' | 'weekly' | 'monthly';
  weekly_days: number[] | null;
  monthly_day: number | null;
  member_order: string[];
  current_member_index: number;
  allow_multiple_completions?: boolean;
  is_active: boolean;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
}

interface EditRotatingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: RotatingTask | null;
  onSuccess: () => void;
}

export function EditRotatingTaskDialog({ open, onOpenChange, task, onSuccess }: EditRotatingTaskDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]);
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [taskGroup, setTaskGroup] = useState<'morning' | 'midday' | 'evening' | 'general'>('general');
  const [allowMultipleCompletions, setAllowMultipleCompletions] = useState(false);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const { data: profiles } = useQuery({
    queryKey: ['family-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, color')
        .order('display_name');
      
      if (error) throw error;
      return data;
    },
  });

  const weekDays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  // Load task data when dialog opens
  useEffect(() => {
    if (task && open) {
      setName(task.name);
      setDescription(task.description || "");
      setPoints(task.points);
      setCadence(task.cadence);
      setWeeklyDays(task.weekly_days || [1]);
      setMonthlyDay(task.monthly_day || 1);
      setSelectedMembers([...task.member_order]);
      setTaskGroup((task as any).task_group || 'general');
      setAllowMultipleCompletions(task.allow_multiple_completions || false);
      setCurrentMemberIndex(task.current_member_index);
      setIsActive(task.is_active);
    }
  }, [task, open]);

  const handleWeeklyDayToggle = (day: number, checked: boolean) => {
    if (checked) {
      setWeeklyDays([...weeklyDays, day].sort());
    } else {
      setWeeklyDays(weeklyDays.filter(d => d !== day));
    }
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId]);
    } else {
      const newMembers = selectedMembers.filter(id => id !== memberId);
      setSelectedMembers(newMembers);
      // Adjust current member index if needed
      if (currentMemberIndex >= newMembers.length) {
        setCurrentMemberIndex(Math.max(0, newMembers.length - 1));
      }
    }
  };

  const removeMember = (memberId: string) => {
    const memberIndex = selectedMembers.indexOf(memberId);
    const newMembers = selectedMembers.filter(id => id !== memberId);
    setSelectedMembers(newMembers);
    
    // Adjust current member index if needed
    if (memberIndex <= currentMemberIndex && currentMemberIndex > 0) {
      setCurrentMemberIndex(currentMemberIndex - 1);
    } else if (currentMemberIndex >= newMembers.length) {
      setCurrentMemberIndex(Math.max(0, newMembers.length - 1));
    }
  };

  const moveeMember = (fromIndex: number, toIndex: number) => {
    const newMembers = [...selectedMembers];
    const [movedMember] = newMembers.splice(fromIndex, 1);
    newMembers.splice(toIndex, 0, movedMember);
    setSelectedMembers(newMembers);
    
    // Adjust current member index if needed
    if (fromIndex === currentMemberIndex) {
      setCurrentMemberIndex(toIndex);
    } else if (fromIndex < currentMemberIndex && toIndex >= currentMemberIndex) {
      setCurrentMemberIndex(currentMemberIndex - 1);
    } else if (fromIndex > currentMemberIndex && toIndex <= currentMemberIndex) {
      setCurrentMemberIndex(currentMemberIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!task) return;

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Task name is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedMembers.length === 0) {
      toast({
        title: "Error",
        description: "At least one family member must be selected",
        variant: "destructive",
      });
      return;
    }

    if (cadence === 'weekly' && weeklyDays.length === 0) {
      toast({
        title: "Error",
        description: "At least one day must be selected for weekly tasks",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('rotating_tasks')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          points,
          cadence,
          weekly_days: cadence === 'weekly' ? weeklyDays : null,
          monthly_day: cadence === 'monthly' ? monthlyDay : null,
          member_order: selectedMembers,
          task_group: taskGroup,
          allow_multiple_completions: allowMultipleCompletions,
          current_member_index: Math.min(currentMemberIndex, selectedMembers.length - 1),
          is_active: isActive,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rotating task updated successfully",
      });

      onSuccess();
    } catch (error) {
      console.error('Error updating rotating task:', error);
      toast({
        title: "Error",
        description: "Failed to update rotating task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('rotating_tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rotating task deleted successfully",
      });

      onSuccess();
    } catch (error) {
      console.error('Error deleting rotating task:', error);
      toast({
        title: "Error",
        description: "Failed to delete rotating task",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rotating Task</DialogTitle>
          <DialogDescription>
            Modify the rotating task settings and member rotation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Take out trash"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about the task"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 10)}
            />
          </div>

          <div>
            <Label>Schedule</Label>
            <Select value={cadence} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setCadence(value)}>
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

          <div>
            <Label>Task Group</Label>
            <Select value={taskGroup} onValueChange={(value: 'morning' | 'midday' | 'evening' | 'general') => setTaskGroup(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="midday">Midday</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cadence === 'weekly' && (
            <div>
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {weekDays.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={weeklyDays.includes(day.value)}
                      onCheckedChange={(checked) => handleWeeklyDayToggle(day.value, checked as boolean)}
                    />
                    <Label htmlFor={`day-${day.value}`} className="text-sm">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cadence === 'monthly' && (
            <div>
              <Label htmlFor="monthlyDay">Day of Month</Label>
              <Input
                id="monthlyDay"
                type="number"
                min="1"
                max="31"
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(parseInt(e.target.value) || 1)}
              />
            </div>
          )}

          <div>
            <Label>Family Members</Label>
            <div className="grid grid-cols-1 gap-2 mt-2 max-h-40 overflow-y-auto">
              {profiles?.map((profile) => (
                <div key={profile.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`member-${profile.id}`}
                    checked={selectedMembers.includes(profile.id)}
                    onCheckedChange={(checked) => handleMemberToggle(profile.id, checked as boolean)}
                  />
                  <Label htmlFor={`member-${profile.id}`} className="text-sm">
                    {profile.display_name}
                  </Label>
                </div>
              ))}
            </div>

            {selectedMembers.length > 0 && (
              <div className="mt-3">
                <Label className="text-sm text-muted-foreground">Rotation Order:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedMembers.map((memberId, index) => {
                    const profile = profiles?.find(p => p.id === memberId);
                    return (
                      <Badge 
                        key={memberId} 
                        variant={index === currentMemberIndex ? "default" : "secondary"} 
                        className="flex items-center gap-1"
                      >
                        {index + 1}. {profile?.display_name}
                        {index === currentMemberIndex && " (Current)"}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => removeMember(memberId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allowMultipleCompletions"
              checked={allowMultipleCompletions}
              onCheckedChange={(checked) => setAllowMultipleCompletions(checked as boolean)}
            />
            <Label htmlFor="allowMultipleCompletions" className="text-sm">
              Allow multiple completions per {cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, allows generating new tasks even if one already exists for the current {cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'}. Useful for tasks that can be done multiple times.
          </p>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked as boolean)}
            />
            <Label htmlFor="isActive" className="text-sm">
              Task is active
            </Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Rotating Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{task.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Task"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}