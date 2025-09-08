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
  currentProfileId?: string;
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
  defaultDate,
  currentProfileId
}: EventDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState<Date>(defaultDate || selectedDate || new Date());
  const [endDate, setEndDate] = useState<Date>(defaultDate || selectedDate || new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [recurrenceOptions, setRecurrenceOptions] = useState<EventRecurrenceOptions>({
    enabled: false,
    rule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never'
    }
  });
  const [showEditScope, setShowEditScope] = useState(false);
  const [editScope, setEditScope] = useState<EditScope>('this_only');

  const { toast } = useToast();
  const { createEventSeries, updateSeries, createException, splitSeries } = useRecurringSeries(familyId || '');

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title || '');
      setDescription(editingEvent.description || '');
      setLocation(editingEvent.location || '');
      
      const eventStartDate = editingEvent.start_date ? new Date(editingEvent.start_date) : new Date();
      const eventEndDate = editingEvent.end_date ? new Date(editingEvent.end_date) : new Date();
      
      setStartDate(eventStartDate);
      setEndDate(eventEndDate);
      setStartTime(format(eventStartDate, 'HH:mm'));
      setEndTime(format(eventEndDate, 'HH:mm'));
      setIsAllDay(editingEvent.is_all_day || false);
      setAssignees(editingEvent.attendees?.map(a => a.profile_id) || []);
      
      if (editingEvent.recurrence_options?.enabled) {
        setRecurrenceOptions({
          enabled: true,
          rule: editingEvent.recurrence_options.rule || {
            frequency: 'daily',
            interval: 1,
            endType: 'never'
          }
        });
      }
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDate(defaultDate || selectedDate || new Date());
      setEndDate(defaultDate || selectedDate || new Date());
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setAssignees(defaultMember ? [defaultMember] : []);
      setRecurrenceOptions({
        enabled: false,
        rule: {
          frequency: 'daily',
          interval: 1,
          endType: 'never'
        }
      });
    }
  }, [editingEvent, selectedDate, defaultMember, defaultDate]);

  // Update start and end dates when time changes
  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    // If end date is before start date, adjust it
    if (endDate < date) {
      setEndDate(date);
    }
  };

  const handleEndDateChange = (date: Date) => {
    setEndDate(date);
  };

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    // Auto-adjust end time to be 1 hour later if it's before start time
    const [startHour, startMin] = time.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    if (endHour < startHour || (endHour === startHour && endMin <= startMin)) {
      const newEndHour = startHour + 1;
      setEndTime(`${newEndHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`);
    }
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
  };

  const handleAllDayChange = (allDay: boolean) => {
    setIsAllDay(allDay);
  };
  const handleSave = async () => {
    if (!familyId || familyId.trim() === '') {
      toast({
        title: "Error",
        description: "Family ID is required",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start_date: isAllDay 
        ? startDate.toISOString()
        : new Date(`${format(startDate, 'yyyy-MM-dd')}T${startTime}`).toISOString(),
      end_date: isAllDay
        ? endDate.toISOString()
        : new Date(`${format(endDate, 'yyyy-MM-dd')}T${endTime}`).toISOString(),
      is_all_day: isAllDay,
      attendees: assignees.filter(id => id && id.trim() !== ''),
      family_id: familyId,
      recurrence_options: recurrenceOptions.enabled ? recurrenceOptions : null
    };

    try {
      if (editingEvent?.isVirtual && editingEvent?.series_id) {
        // Validate series_id and created_by are valid UUIDs
        if (!editingEvent.series_id || editingEvent.series_id.trim() === '') {
          toast({
            title: "Error",
            description: "Invalid series ID for recurring event",
            variant: "destructive",
          });
          return;
        }
        
        if (!editingEvent.created_by || editingEvent.created_by.trim() === '') {
          toast({
            title: "Error",
            description: "Invalid creator ID for recurring event",
            variant: "destructive",
          });
          return;
        }
        
        if (editScope === 'this_only') {
          await createException({
            series_id: editingEvent.series_id,
            series_type: 'event',
            exception_date: editingEvent.occurrence_date || format(startDate, 'yyyy-MM-dd'),
            exception_type: 'override',
            override_data: eventData,
            created_by: editingEvent.created_by
          });
        } else if (editScope === 'this_and_following') {
          await splitSeries(editingEvent.series_id, 'event', startDate, {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees,
            family_id: eventData.family_id,
            created_by: editingEvent.created_by,
            recurrence_rule: recurrenceOptions.rule,
            series_start: eventData.start_date,
            is_active: true
          });
        } else {
          await updateSeries(editingEvent.series_id, 'event', {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees
          });
        }
      } else if (recurrenceOptions.enabled) {
        // Validate we have a valid created_by UUID for new recurring events
        const createdBy = editingEvent?.created_by || currentProfileId;
        if (!createdBy || createdBy.trim() === '') {
          toast({
            title: "Error",
            description: "Unable to determine event creator. Please try again.",
            variant: "destructive",
          });
          return;
        }

        const seriesData = {
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
          is_all_day: eventData.is_all_day,
          attendee_profiles: eventData.attendees,
          family_id: eventData.family_id,
          created_by: createdBy,
          recurrence_rule: recurrenceOptions.rule,
          series_start: eventData.start_date,
          is_active: true
        };
        await createEventSeries(seriesData);
      } else {
        onSave?.(eventData);
      }

      // Trigger calendar refresh after any event operation
      if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
        setTimeout(() => {
          console.log('EventDialog triggering calendar refresh');
          (window as any).refreshCalendar();
        }, 200);
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
    if (editingEvent?.isVirtual && editingEvent?.series_id) {
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
              <div className="col-span-2">
                <DateTimePicker
                  startDate={startDate}
                  endDate={endDate}
                  startTime={startTime}
                  endTime={endTime}
                  isAllDay={isAllDay}
                  onStartDateChange={handleStartDateChange}
                  onEndDateChange={handleEndDateChange}
                  onStartTimeChange={handleStartTimeChange}
                  onEndTimeChange={handleEndTimeChange}
                  onAllDayChange={handleAllDayChange}
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
                selectedAssignees={assignees}
                onAssigneesChange={setAssignees}
                placeholder="Select attendees"
              />
            </div>

            {!editingEvent?.isVirtual && (
              <UnifiedRecurrencePanel
                type="event"
                enabled={recurrenceOptions.enabled}
                onEnabledChange={(enabled) => setRecurrenceOptions(prev => ({ ...prev, enabled }))}
                startDate={startDate}
                startTime={startTime}
                eventOptions={recurrenceOptions}
                onEventOptionsChange={setRecurrenceOptions}
              />
            )}

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
        itemType="event"
        occurrenceDate={editingEvent?.start_date ? new Date(editingEvent.start_date) : undefined}
      />
    </>
  );
};