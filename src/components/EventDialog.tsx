import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useEvents } from '@/hooks/useEvents';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';
import { EventRecurrenceOptions } from '@/types/recurrence';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';
import { EditScopeDialog, EditScope } from '@/components/recurrence/EditScopeDialog';
import { Badge } from '@/components/ui/badge';
import { Repeat } from 'lucide-react';
import { useRecurringSeries } from '@/hooks/useRecurringSeries';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date | null;
  familyId?: string;
  defaultMember?: string;
  event?: CalendarEvent | null;
  familyMembers?: any[];
  onSave?: (eventData: any) => void;
  onDelete?: () => void;
  editingEvent?: CalendarEvent | null;
  defaultDate?: Date;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  familyId,
  defaultMember,
  event,
  familyMembers = [],
  onSave,
  onDelete,
  editingEvent,
  defaultDate
}: EventDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState<Date>(defaultDate || selectedDate || new Date());
  const [endDate, setEndDate] = useState<Date>(defaultDate || selectedDate || new Date());
  const [assignees, setAssignees] = useState<string[]>([]);
  const [recurrenceOptions, setRecurrenceOptions] = useState<EventRecurrenceOptions>({
    enabled: false,
    frequency: 'daily',
    interval: 1,
    daysOfWeek: [],
    endDate: null,
    count: null
  });
  const [showEditScope, setShowEditScope] = useState(false);
  const [editScope, setEditScope] = useState<EditScope>('this');

  const { toast } = useToast();
  const { createEventSeries, updateSeries, createException, splitSeries } = useRecurringSeries(familyId || '');

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title || '');
      setDescription(editingEvent.description || '');
      setLocation(editingEvent.location || '');
      setStartDate(editingEvent.start_date ? new Date(editingEvent.start_date) : new Date());
      setEndDate(editingEvent.end_date ? new Date(editingEvent.end_date) : new Date());
      setAssignees(editingEvent.attendees || []);
      
      if (editingEvent.series_id) {
        setRecurrenceOptions({
          enabled: true,
          frequency: editingEvent.recurrence_rule?.frequency || 'daily',
          interval: editingEvent.recurrence_rule?.interval || 1,
          daysOfWeek: editingEvent.recurrence_rule?.daysOfWeek || [],
          endDate: editingEvent.recurrence_rule?.endDate ? new Date(editingEvent.recurrence_rule.endDate) : null,
          count: editingEvent.recurrence_rule?.count || null
        });
      }
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDate(defaultDate || selectedDate || new Date());
      setEndDate(defaultDate || selectedDate || new Date());
      setAssignees(defaultMember ? [defaultMember] : []);
      setRecurrenceOptions({
        enabled: false,
        frequency: 'daily',
        interval: 1,
        daysOfWeek: [],
        endDate: null,
        count: null
      });
    }
  }, [editingEvent, selectedDate, defaultMember, defaultDate]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    if (!familyId) {
      toast({
        title: "Error",
        description: "Family ID is required",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      attendees: assignees,
      family_id: familyId,
    };

    try {
      if (editingEvent?.series_id && recurrenceOptions.enabled) {
        if (editScope === 'this') {
          await createException(editingEvent.series_id, startDate, 'override', eventData);
        } else if (editScope === 'future') {
          await splitSeries(editingEvent.series_id, startDate, eventData, recurrenceOptions);
        } else {
          await updateSeries(editingEvent.series_id, eventData, recurrenceOptions);
        }
      } else if (recurrenceOptions.enabled) {
        await createEventSeries(eventData, recurrenceOptions);
      } else {
        onSave?.(eventData);
      }

      toast({
        title: "Success",
        description: editingEvent ? "Event updated successfully" : "Event created successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditScopeSelect = (scope: EditScope) => {
    setEditScope(scope);
    setShowEditScope(false);
    handleSave();
  };

  const handleSubmit = () => {
    if (editingEvent?.series_id && recurrenceOptions.enabled) {
      setShowEditScope(true);
    } else {
      handleSave();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {editingEvent ? 'Edit Event' : 'Create Event'}
              {editingEvent?.series_id && (
                <Badge variant="secondary" className="ml-2">
                  <Repeat className="w-3 h-3 mr-1" />
                  Recurring
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Event location"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <DateTimePicker
                  date={startDate}
                  setDate={setStartDate}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <DateTimePicker
                  date={endDate}
                  setDate={setEndDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendees
              </Label>
              <MultiSelectAssignees
                familyMembers={familyMembers}
                selectedMembers={assignees}
                onSelectionChange={setAssignees}
                placeholder="Select attendees"
              />
            </div>

            <UnifiedRecurrencePanel
              options={recurrenceOptions}
              onChange={setRecurrenceOptions}
            />

            <div className="flex justify-between pt-4">
              <div>
                {onDelete && editingEvent && (
                  <Button
                    variant="destructive"
                    onClick={onDelete}
                  >
                    Delete Event
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EditScopeDialog
        open={showEditScope}
        onOpenChange={setShowEditScope}
        onScopeSelect={handleEditScopeSelect}
      />
    </>
  );
};