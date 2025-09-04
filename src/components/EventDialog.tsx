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
import { useEvents } from '@/hooks/useEvents';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CalendarEvent } from '@/types/event';
import { EventRecurrenceOptions } from '@/types/recurrence';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: new Date(),
    endDate: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    attendees: [] as string[]
  });

  // Recurrence state
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [eventRecurrenceOptions, setEventRecurrenceOptions] = useState<EventRecurrenceOptions>({
    enabled: false,
    rule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never'
    }
  });

  const { toast } = useToast();

  useEffect(() => {
    const eventToEdit = editingEvent || event;
    if (eventToEdit) {
      setFormData({
        title: eventToEdit.title || '',
        description: eventToEdit.description || '',
        location: eventToEdit.location || '',
        startDate: eventToEdit.start_date ? new Date(eventToEdit.start_date) : (selectedDate || new Date()),
        endDate: eventToEdit.end_date ? new Date(eventToEdit.end_date) : (selectedDate || new Date()),
        startTime: eventToEdit.start_date ? format(new Date(eventToEdit.start_date), 'HH:mm') : '09:00',
        endTime: eventToEdit.end_date ? format(new Date(eventToEdit.end_date), 'HH:mm') : '10:00',
        isAllDay: eventToEdit.is_all_day || false,
        attendees: eventToEdit.attendees?.map((a: any) => a.profile_id) || []
      });
    } else {
      // Reset form for new event
      const defaultFormDate = selectedDate || defaultDate || new Date();
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: defaultFormDate,
        endDate: defaultFormDate,
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
        attendees: defaultMember ? [defaultMember] : []
      });

      // Reset recurrence for new events
      setRecurrenceEnabled(false);
      setEventRecurrenceOptions({
        enabled: false,
        rule: {
          frequency: 'daily',
          interval: 1,
          endType: 'never'
        }
      });
    }
  }, [event, editingEvent, selectedDate, defaultDate, defaultMember]);

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an event title',
        variant: 'destructive'
      });
      return;
    }

    const eventData = {
      title: formData.title,
      description: formData.description,
      location: formData.location,
      start_date: formData.isAllDay 
        ? new Date(formData.startDate).toISOString()
        : new Date(`${format(formData.startDate, 'yyyy-MM-dd')}T${formData.startTime}`).toISOString(),
      end_date: formData.isAllDay
        ? new Date(formData.endDate).toISOString()
        : new Date(`${format(formData.endDate, 'yyyy-MM-dd')}T${formData.endTime}`).toISOString(),
      is_all_day: formData.isAllDay,
      attendees: formData.attendees,
      // Include recurrence data if enabled - cast to unknown then any for Supabase
      recurrence_options: recurrenceEnabled ? (eventRecurrenceOptions as unknown as any) : null
    };

    onSave?.(eventData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {editingEvent || event ? 'Edit Event' : 'Create Event'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Event description (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Event location (optional)"
                className="pl-10"
              />
            </div>
          </div>

          <DateTimePicker
            startDate={formData.startDate}
            endDate={formData.endDate}
            startTime={formData.startTime}
            endTime={formData.endTime}
            isAllDay={formData.isAllDay}
            onStartDateChange={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
            onEndDateChange={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
            onStartTimeChange={(time) => setFormData(prev => ({ ...prev, startTime: time }))}
            onEndTimeChange={(time) => setFormData(prev => ({ ...prev, endTime: time }))}
            onAllDayChange={(isAllDay) => setFormData(prev => ({ ...prev, isAllDay }))}
          />

          {/* Event Assignees */}
          <div>
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendees
            </Label>
            <MultiSelectAssignees
              familyMembers={familyMembers}
              selectedAssignees={formData.attendees}
              onAssigneesChange={(attendees) => setFormData(prev => ({ ...prev, attendees }))}
              placeholder="Select event attendees..."
            />
          </div>

          {/* Recurrence Panel */}
          <UnifiedRecurrencePanel
            enabled={recurrenceEnabled}
            onEnabledChange={(enabled) => {
              setRecurrenceEnabled(enabled);
              setEventRecurrenceOptions(prev => ({ ...prev, enabled }));
            }}
            startDate={formData.startDate}
            startTime={formData.startTime}
            type="event"
            eventOptions={eventRecurrenceOptions}
            onEventOptionsChange={setEventRecurrenceOptions}
            familyMembers={familyMembers}
            selectedAssignees={formData.attendees}
          />

          <div className="flex justify-between">
            <div className="flex gap-2">
              {onDelete && (
                <Button variant="destructive" onClick={onDelete}>
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingEvent || event ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};