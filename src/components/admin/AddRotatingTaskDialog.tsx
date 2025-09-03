import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface AddRotatingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddRotatingTaskDialog({ open, onOpenChange, onSuccess }: AddRotatingTaskDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]); // Monday by default
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [taskGroup, setTaskGroup] = useState<'morning' | 'midday' | 'afternoon' | 'general'>('general');
  const [allowMultipleCompletions, setAllowMultipleCompletions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
    }
  };

  const removeMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter(id => id !== memberId));
  };

  const handleSubmit = async () => {
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
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, family_id')
        .eq('user_id', currentUser.user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('rotating_tasks')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          points,
          cadence,
          weekly_days: cadence === 'weekly' ? weeklyDays : null,
          monthly_day: cadence === 'monthly' ? monthlyDay : null,
          member_order: selectedMembers,
          current_member_index: 0,
          task_group: taskGroup,
          allow_multiple_completions: allowMultipleCompletions,
          family_id: profile.family_id,
          created_by: profile.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rotating task created successfully",
      });

      // Reset form
      setName("");
      setDescription("");
      setPoints(10);
      setCadence('daily');
      setWeeklyDays([1]);
      setMonthlyDay(1);
      setSelectedMembers([]);
      setTaskGroup('general');
      setAllowMultipleCompletions(false);

      onSuccess();
    } catch (error) {
      console.error('Error creating rotating task:', error);
      toast({
        title: "Error",
        description: "Failed to create rotating task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Rotating Task</DialogTitle>
          <DialogDescription>
            Create a task that automatically rotates between selected family members
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
            <Select value={taskGroup} onValueChange={(value: 'morning' | 'midday' | 'afternoon' | 'general') => setTaskGroup(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="midday">Midday</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
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
                      <Badge key={memberId} variant="secondary" className="flex items-center gap-1">
                        {index + 1}. {profile?.display_name}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Rotating Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}