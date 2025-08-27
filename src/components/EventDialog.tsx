import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { CalendarIcon, Clock, MapPin, X } from 'lucide-react';
import { format } from 'date-fns';
import { Profile } from '@/types/task';

import { cn } from '@/lib/utils';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyMembers: Profile[];
  onSave: (data: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_date: string;
    end_date: string;
    is_all_day: boolean;
    attendees?: string[];
  }) => void;
  onDelete?: () => void;
  editingEvent?: Event | null;
  defaultDate?: Date;
  defaultMember?: string;
}

export const EventDialog = ({
  open,
  onOpenChange,
  familyMembers,
  onSave,
  onDelete,
  editingEvent,
  defaultDate,
  defaultMember
}: EventDialogProps) => {
  const [title, setTitle] = useState(editingEvent?.title || '');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [location, setLocation] = useState(editingEvent?.location || '');
  const [startDate, setStartDate] = useState<Date>(
    editingEvent ? new Date(editingEvent.start_date) : defaultDate || new Date()
  );
  const [endDate, setEndDate] = useState<Date>(
    editingEvent ? new Date(editingEvent.end_date) : 
    defaultDate ? new Date(defaultDate.getTime() + 60 * 60 * 1000) : 
    new Date(Date.now() + 60 * 60 * 1000)
  );
  const [startTime, setStartTime] = useState(
    editingEvent ? format(new Date(editingEvent.start_date), 'HH:mm') :
    format(new Date(), 'HH:mm')
  );
  const [endTime, setEndTime] = useState(
    editingEvent ? format(new Date(editingEvent.end_date), 'HH:mm') :
    format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm')
  );
  const [isAllDay, setIsAllDay] = useState(editingEvent?.is_all_day || false);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(
    editingEvent?.attendees?.map(a => a.profile_id) || 
    (defaultMember ? [defaultMember] : [])
  );

  // Reset form when editing event changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingEvent) {
        // Populate form with existing event data
        setTitle(editingEvent.title || '');
        setDescription(editingEvent.description || '');
        setLocation(editingEvent.location || '');
        setStartDate(new Date(editingEvent.start_date));
        setEndDate(new Date(editingEvent.end_date));
        setStartTime(format(new Date(editingEvent.start_date), 'HH:mm'));
        setEndTime(format(new Date(editingEvent.end_date), 'HH:mm'));
        setIsAllDay(editingEvent.is_all_day || false);
        setSelectedAttendees(editingEvent.attendees?.map(a => a.profile_id) || []);
      } else {
        // Reset form for new event
        setTitle('');
        setDescription('');
        setLocation('');
        const newStartDate = defaultDate || new Date();
        const newEndDate = defaultDate ? new Date(defaultDate.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        setStartTime(format(newStartDate, 'HH:mm'));
        setEndTime(format(newEndDate, 'HH:mm'));
        setIsAllDay(false);
        setSelectedAttendees(defaultMember ? [defaultMember] : []);
      }
    }
  }, [open, editingEvent, defaultDate, defaultMember]);

  const toggleAttendee = (memberId: string) => {
    setSelectedAttendees(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const removeAttendee = (memberId: string) => {
    setSelectedAttendees(prev => prev.filter(id => id !== memberId));
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Combine date and time
    const startDateTime = isAllDay 
      ? new Date(startDate.setHours(0, 0, 0, 0))
      : new Date(`${format(startDate, 'yyyy-MM-dd')}T${startTime}`);
    
    const endDateTime = isAllDay
      ? new Date(endDate.setHours(23, 59, 59, 999))
      : new Date(`${format(endDate, 'yyyy-MM-dd')}T${endTime}`);

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      is_all_day: isAllDay,
      attendees: selectedAttendees,
    };

    onSave(data);
    onOpenChange(false);
    
    // Reset form
    setTitle('');
    setDescription('');
    setLocation('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setStartTime(format(new Date(), 'HH:mm'));
    setEndTime(format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm'));
    setIsAllDay(false);
    setSelectedAttendees([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingEvent ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Family Movie Night"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this event..."
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where is this taking place?"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allDay"
                checked={isAllDay}
                onCheckedChange={(checked) => setIsAllDay(checked as boolean)}
              />
              <Label htmlFor="allDay">All day event</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Start Date/Time */}
              <div className="space-y-2">
                <Label>Start</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {!isAllDay && (
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
              </div>

              {/* End Date/Time */}
              <div className="space-y-2">
                <Label>End</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {!isAllDay && (
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-4">
            <Label>Attendees</Label>
            
            {/* Selected Attendees */}
            {selectedAttendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedAttendees.map(memberId => {
                  const member = familyMembers.find(m => m.id === memberId);
                  if (!member) return null;

                  return (
                    <Badge key={memberId} variant="secondary" className="px-3 py-1">
                      <UserAvatar
                        name={member.display_name}
                        color={member.color}
                        size="sm"
                        className="mr-2"
                      />
                      {member.display_name}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttendee(memberId)}
                        className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Available Members */}
            <div className="grid grid-cols-2 gap-2">
              {familyMembers.map(member => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`attendee-${member.id}`}
                    checked={selectedAttendees.includes(member.id)}
                    onCheckedChange={() => toggleAttendee(member.id)}
                  />
                  <Label 
                    htmlFor={`attendee-${member.id}`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <UserAvatar
                      name={member.display_name}
                      color={member.color}
                      size="sm"
                    />
                    {member.display_name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <div>
              {editingEvent && onDelete && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    onDelete();
                    onOpenChange(false);
                  }}
                >
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!title.trim()}
              >
                {editingEvent ? 'Update' : 'Create'} Event
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};