import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { GripVertical, X } from 'lucide-react';
import { Profile } from '@/types/task';
import { RotatingTask } from '@/types/rotating-tasks';
import { cn } from '@/lib/utils';

interface RotatingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMembers: Profile[];
  onSave: (data: {
    name: string;
    cadence: 'daily' | 'weekly' | 'monthly';
    weekly_days?: number[] | null;
    monthly_day?: number | null;
    member_order: string[];
    points: number;
    description?: string | null;
    is_active?: boolean;
  }) => void;
  editingTask?: RotatingTask | null;
}

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' }
];

export const RotatingTaskDialog = ({
  open,
  onOpenChange,
  familyMembers,
  onSave,
  editingTask
}: RotatingTaskDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [monthlyDay, setMonthlyDay] = useState<number>(1);
  const [points, setPoints] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [memberOrder, setMemberOrder] = useState<string[]>([]);

  // Update form state when editingTask changes
  useEffect(() => {
    if (editingTask) {
      setName(editingTask.name);
      setDescription(editingTask.description || '');
      setCadence(editingTask.cadence);
      setWeeklyDays(editingTask.weekly_days || []);
      setMonthlyDay(editingTask.monthly_day || 1);
      setPoints(editingTask.points);
      setIsActive(editingTask.is_active);
      setMemberOrder(editingTask.member_order);
    } else {
      // Reset to defaults for new task
      setName('');
      setDescription('');
      setCadence('daily');
      setWeeklyDays([]);
      setMonthlyDay(1);
      setPoints(10);
      setIsActive(true);
      setMemberOrder(familyMembers.map(m => m.id));
    }
  }, [editingTask, familyMembers]);

  const handleWeekdayToggle = (day: number) => {
    setWeeklyDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(memberOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setMemberOrder(items);
  };

  const removeMember = (memberId: string) => {
    setMemberOrder(prev => prev.filter(id => id !== memberId));
  };

  const addMember = (memberId: string) => {
    if (!memberOrder.includes(memberId)) {
      setMemberOrder(prev => [...prev, memberId]);
    }
  };

  const handleSave = () => {
    if (!name.trim() || memberOrder.length === 0) return;

    const data = {
      name: name.trim(),
      cadence,
      weekly_days: cadence === 'weekly' ? weeklyDays : null,
      monthly_day: cadence === 'monthly' ? monthlyDay : null,
      member_order: memberOrder,
      points,
      description: description.trim() || null,
      is_active: isActive,
    };

    onSave(data);
    onOpenChange(false);
  };

  const availableMembers = familyMembers.filter(m => !memberOrder.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTask ? 'Edit Rotating Task' : 'Create Rotating Task'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Task Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Evening dishes"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this task..."
              />
            </div>

            <div>
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                min="1"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-active">Active Task</Label>
                <div className="text-sm text-muted-foreground">
                  When active, this task will generate instances and appear in task lists
                </div>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* Cadence Settings */}
          <div className="space-y-4">
            <div>
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={(value: any) => setCadence(value)}>
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

            {cadence === 'weekly' && (
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {WEEKDAYS.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={weeklyDays.includes(day.value)}
                        onCheckedChange={() => handleWeekdayToggle(day.value)}
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
                  onChange={(e) => setMonthlyDay(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Member Rotation Order */}
          <div className="space-y-4">
            <Label>Member Rotation Order</Label>
            <p className="text-sm text-muted-foreground">
              Drag to reorder. Tasks will rotate through members in this order.
            </p>

            {/* Available Members to Add */}
            {availableMembers.length > 0 && (
              <div>
                <Label className="text-sm">Available Members</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableMembers.map(member => (
                    <Button
                      key={member.id}
                      variant="outline"
                      size="sm"
                      onClick={() => addMember(member.id)}
                      className="h-auto p-2"
                    >
                      <UserAvatar
                        name={member.display_name}
                        color={member.color}
                        size="sm"
                        className="mr-2"
                      />
                      {member.display_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Rotation Order */}
            <div>
              <Label className="text-sm">Rotation Order</Label>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="members">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 mt-2"
                    >
                      {memberOrder.map((memberId, index) => {
                        const member = familyMembers.find(m => m.id === memberId);
                        if (!member) return null;

                        return (
                          <Draggable key={memberId} draggableId={memberId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-center gap-3 p-3 border rounded-lg bg-background",
                                  snapshot.isDragging && "shadow-lg"
                                )}
                              >
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                
                                <Badge variant="outline" className="text-xs min-w-[2rem]">
                                  {index + 1}
                                </Badge>

                                <UserAvatar
                                  name={member.display_name}
                                  color={member.color}
                                  size="sm"
                                />

                                <div className="flex-1">
                                  <div className="font-medium">{member.display_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {member.role}
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMember(memberId)}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!name.trim() || memberOrder.length === 0}
            >
              {editingTask ? 'Update' : 'Create'} Rotating Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};