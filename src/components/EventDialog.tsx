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
import { useAuth } from '@/hooks/useAuth';
import { CalendarEvent } from '@/types/event';
import { EventRecurrenceOptions } from '@/types/recurrence';
import { MultiSelectAssignees } from '@/components/ui/multi-select-assignees';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { UnifiedRecurrencePanel } from '@/components/recurrence/UnifiedRecurrencePanel';
import { EditScopeDialog, EditScope } from '@/components/recurrence/EditScopeDialog';
import { Badge } from '@/components/ui/badge';
import { Repeat, Settings, Trash2 } from 'lucide-react';
import { useRecurringSeries } from '@/hooks/useRecurringSeries';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RecurringEventInfo } from '@/components/recurrence/RecurringEventInfo';

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
  const [showSeriesOptions, setShowSeriesOptions] = useState(false);
  const [seriesData, setSeriesData] = useState<any>(null);
  const [showDeleteSeriesDialog, setShowDeleteSeriesDialog] = useState(false);

  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, session } = useAuth();
  const { createEventSeries, updateSeries, createException, splitSeries, deleteSeries, getSeriesById } = useRecurringSeries(familyId || '');

  // Effect to get current user's profile ID as fallback and debug auth status
  useEffect(() => {
    const getCurrentUserProfile = async () => {
      console.log('EventDialog - currentProfileId provided:', currentProfileId);
      
      if (currentProfileId) {
        setCurrentUserProfileId(currentProfileId);
        return;
      }

      if (!familyId) {
        console.log('EventDialog - No familyId provided');
        return;
      }

      try {
        // Check authentication status
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('EventDialog - Current authenticated user:', user?.id, 'Error:', userError);
        
        if (!user) {
          console.log('EventDialog - No authenticated user found');
          toast({
            title: "Authentication Required",
            description: "Please sign in to create events.",
            variant: "destructive",
          });
          return;
        }
        
        // Check if user has a profile
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, family_id')
          .eq('user_id', user.id)
          .eq('family_id', familyId)
          .limit(1);
        
        console.log('EventDialog - Profile query result:', profiles, 'Error:', profileError);
          
        if (profiles && profiles.length > 0) {
          setCurrentUserProfileId(profiles[0].id);
          console.log('EventDialog - Set currentUserProfileId to:', profiles[0].id);
        } else {
          console.log('EventDialog - No profile found for user in this family');
          toast({
            title: "Profile Not Found",
            description: "No profile found for your account in this family.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('EventDialog - Error getting current user profile:', error);
        toast({
          title: "Error",
          description: "Failed to verify user authentication.",
          variant: "destructive",
        });
      }
    };

    getCurrentUserProfile();
  }, [currentProfileId, familyId, toast]);

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
      
      // If this is a virtual event (part of a series), load the series data
      if (editingEvent.isVirtual && editingEvent.series_id) {
        const series = getSeriesById(editingEvent.series_id, 'event');
        if (series) {
          setSeriesData(series);
          setRecurrenceOptions({
            enabled: true,
            rule: series.recurrence_rule
          });
        }
      } else if (editingEvent.recurrence_options?.enabled) {
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
      setSeriesData(null);
      setShowSeriesOptions(false);
      setRecurrenceOptions({
        enabled: false,
        rule: {
          frequency: 'daily',
          interval: 1,
          endType: 'never'
        }
      });
    }
  }, [editingEvent, selectedDate, defaultMember, defaultDate, getSeriesById]);

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
    console.log('EventDialog handleSave called');
    console.log('Authentication status:', { user: !!user, session: !!session });
    console.log('familyId:', familyId);
    console.log('currentProfileId:', currentProfileId);
    console.log('title:', title);
    
    // Check authentication first
    if (!user || !session) {
      console.error('User not authenticated');
      toast({
        title: "Authentication Required", 
        description: "Please sign in to create events.",
        variant: "destructive",
      });
      return;
    }
    
    if (!familyId || familyId.trim() === '') {
      toast({
        title: "Error",
        description: "Family ID is required",
        variant: "destructive",
      });
      return;
    }

    if (!currentProfileId) {
      console.error('Missing currentProfileId');
      toast({
        title: "Error",
        description: "Unable to determine event creator - please ensure you're logged in",
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

    const calculatedStartDate = isAllDay 
      ? startDate.toISOString()
      : new Date(`${format(startDate, 'yyyy-MM-dd')}T${startTime}`).toISOString();
    const calculatedEndDate = isAllDay
      ? endDate.toISOString()
      : new Date(`${format(endDate, 'yyyy-MM-dd')}T${endTime}`).toISOString();

    // Validate that end date is not before start date
    if (new Date(calculatedEndDate) < new Date(calculatedStartDate)) {
      toast({
        title: "Error",
        description: "End date/time cannot be before start date/time",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start_date: calculatedStartDate,
      end_date: calculatedEndDate,
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
          const updateData: any = {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees
          };
          
          // If we're editing the series, also update the recurrence rule
          if (showSeriesOptions && recurrenceOptions.enabled) {
            updateData.recurrence_rule = recurrenceOptions.rule;
          }
          
          await updateSeries(editingEvent.series_id, 'event', updateData);
        }
      } else if (recurrenceOptions.enabled) {
        // Validate we have a valid created_by UUID for new recurring events
        const createdBy = editingEvent?.created_by || currentProfileId || currentUserProfileId;
        console.log('EventDialog - Attempting to create recurring event with createdBy:', createdBy);
        console.log('EventDialog - currentProfileId:', currentProfileId);
        console.log('EventDialog - editingEvent?.created_by:', editingEvent?.created_by);
        
        if (!createdBy || createdBy.trim() === '') {
          console.error('EventDialog - No valid createdBy ID for recurring event creation');
          toast({
            title: "Error",
            description: "Cannot create recurring event: No user profile found. Please try refreshing the page.",
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
        console.log('Creating event series with data:', seriesData);
        try {
          await createEventSeries(seriesData);
          console.log('Event series created successfully');
        } catch (error: any) {
          console.error('Failed to create event series:', error);
          
          // Provide specific error messages based on the error type
          let errorMessage = "Failed to save event. Please try again.";
          
          if (error.message?.includes('permission') || error.message?.includes('policy') || error.code === '42501') {
            errorMessage = "Authentication required. Please sign in to create events.";
          } else if (error.message?.includes('not authenticated')) {
            errorMessage = "Please sign in to create recurring events.";
          } else if (error.message?.includes('RLS')) {
            errorMessage = "You don't have permission to create events. Please sign in.";
          }
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      } else {
        console.log('Creating single event with currentProfileId:', currentProfileId);
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
    } catch (error: any) {
      console.error('Error saving event:', error);
      
      // Provide specific error messages
      let errorMessage = "Failed to save event. Please try again.";
      
      if (error.message?.includes('permission') || error.message?.includes('policy') || error.code === '42501') {
        errorMessage = "Authentication required. Please sign in to create events.";
      } else if (error.message?.includes('not authenticated')) {
        errorMessage = "Please sign in to create events.";
      } else if (error.message?.includes('RLS')) {
        errorMessage = "You don't have permission to create events. Please sign in.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
      if (showSeriesOptions) {
        // We're editing the series itself
        handleSave();
      } else {
        // Show edit scope dialog for instance edits
        setShowEditScope(true);
      }
    } else {
      handleSave();
    }
  };

  const handleDeleteSeries = async () => {
    if (!editingEvent?.series_id) return;
    
    try {
      await deleteSeries(editingEvent.series_id, 'event');
      
      // Trigger calendar refresh
      if (typeof window !== 'undefined' && (window as any).refreshCalendar) {
        setTimeout(() => {
          (window as any).refreshCalendar();
        }, 200);
      }

      toast({
        title: "Success",
        description: "Event series deleted successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting series:', error);
    }
  };

  const handleEditSeries = () => {
    setShowSeriesOptions(true);
    // Pre-populate form with series data
    if (seriesData) {
      setTitle(seriesData.title);
      setDescription(seriesData.description || '');
      setLocation(seriesData.location || '');
      setRecurrenceOptions({
        enabled: true,
        rule: seriesData.recurrence_rule
      });
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

            {/* Series Management Options */}
            {editingEvent?.isVirtual && editingEvent?.series_id && seriesData && !showSeriesOptions && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Recurring Event</h4>
                    <p className="text-xs text-muted-foreground">
                      This is part of a recurring event series
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Repeat className="w-3 h-3 mr-1" />
                    Series
                  </Badge>
                </div>
                
                <RecurringEventInfo 
                  rule={seriesData.recurrence_rule}
                  seriesStart={seriesData.series_start}
                  seriesEnd={seriesData.series_end}
                  className="px-2"
                />
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditSeries}
                    className="flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Edit Series
                  </Button>
                  
                  <AlertDialog open={showDeleteSeriesDialog} onOpenChange={setShowDeleteSeriesDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete Series
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Recurring Event Series</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all occurrences of "{seriesData.title}" and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSeries}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Series
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* Series Editing Mode */}
            {showSeriesOptions && seriesData && (
              <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Editing Entire Series</h4>
                    <p className="text-xs text-muted-foreground">
                      Changes will apply to all occurrences in this series
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSeriesOptions(false)}
                  >
                    Cancel Series Edit
                  </Button>
                </div>
                
                <UnifiedRecurrencePanel
                  type="event"
                  enabled={recurrenceOptions.enabled}
                  onEnabledChange={(enabled) => setRecurrenceOptions(prev => ({ ...prev, enabled }))}
                  startDate={startDate}
                  startTime={startTime}
                  eventOptions={recurrenceOptions}
                  onEventOptionsChange={setRecurrenceOptions}
                />
              </div>
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
                  {showSeriesOptions ? 'Update Series' : editingEvent ? 'Update Event' : 'Create Event'}
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