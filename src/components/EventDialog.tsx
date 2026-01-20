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
import { DateTimePickerInline } from '@/components/ui/inline-date-picker';
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
  const [isEditMode, setIsEditMode] = useState(false);
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
  const [applyToOverrides, setApplyToOverrides] = useState(false);
  const [showSeriesOptions, setShowSeriesOptions] = useState(false);
  const [seriesData, setSeriesData] = useState<any>(null);
  const [showDeleteSeriesDialog, setShowDeleteSeriesDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, session } = useAuth();
  const { createEventSeries, updateSeries, createException, splitSeries, deleteSeries, getSeriesById, skipOccurrence } = useRecurringSeries(familyId || '');

  // Get current user's profile ID
  useEffect(() => {
    const getCurrentUserProfile = async () => {
      if (currentProfileId) {
        setCurrentUserProfileId(currentProfileId);
        return;
      }

      if (!familyId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('family_id', familyId)
          .limit(1);
          
        if (profiles?.[0]) {
          setCurrentUserProfileId(profiles[0].id);
        }
      } catch (error) {
        console.error('Error getting user profile:', error);
      }
    };

    getCurrentUserProfile();
  }, [currentProfileId, familyId]);

  useEffect(() => {
    if (editingEvent) {
      console.log('[EventDialog] Opening event:', {
        title: editingEvent.title,
        isVirtual: editingEvent.isVirtual,
        series_id: editingEvent.series_id,
        occurrence_date: editingEvent.occurrence_date,
        source_type: editingEvent.source_type
      });
      
      // Start in view mode when opening an existing event
      setIsEditMode(false);
      
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
      
      // Load series data for virtual events
      if (editingEvent.isVirtual && editingEvent.series_id) {
        const series = getSeriesById(editingEvent.series_id, 'event');
        console.log('[EventDialog] Series data loaded:', series);
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
      // Creating new event - start in edit mode
      setIsEditMode(true);
      
      // Reset all form state
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
      setIsLoading(false);
      setRecurrenceOptions({
        enabled: false,
        rule: {
          frequency: 'daily',
          interval: 1,
          endType: 'never'
        }
      });
    }
  }, [editingEvent, selectedDate, defaultMember, defaultDate, familyId]);

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
  // Separated save function that takes scope as parameter to avoid stale state
  const handleSaveWithScope = async (scope: EditScope, shouldApplyToOverrides: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    if (!user || !session) {
      toast({
        title: "Authentication Required", 
        description: "Please sign in to create events.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    if (!familyId || !currentProfileId || !title.trim()) {
      toast({
        title: "Error",
        description: !familyId ? "Family ID required" : !currentProfileId ? "User profile not found" : "Event title required",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const calculatedStartDate = isAllDay 
      ? format(startDate, 'yyyy-MM-dd') + 'T00:00:00Z'
      : new Date(`${format(startDate, 'yyyy-MM-dd')}T${startTime}`).toISOString();
    const calculatedEndDate = isAllDay
      ? format(endDate, 'yyyy-MM-dd') + 'T23:59:59Z'
      : new Date(`${format(endDate, 'yyyy-MM-dd')}T${endTime}`).toISOString();

    if (new Date(calculatedEndDate) < new Date(calculatedStartDate)) {
      toast({
        title: "Error",
        description: "End date/time cannot be before start date/time",
        variant: "destructive",
      });
      setIsLoading(false);
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
        if (!editingEvent.series_id || editingEvent.series_id.trim() === '') {
          toast({ title: "Error", description: "Invalid series ID for recurring event", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        
        if (!editingEvent.created_by || editingEvent.created_by.trim() === '') {
          toast({ title: "Error", description: "Invalid creator ID for recurring event", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        
        console.debug('[EventDialog] Saving with scope:', scope, 'applyToOverrides:', shouldApplyToOverrides);
        
        if (scope === 'this_only') {
          const exceptionDateStr = editingEvent.occurrence_date || format(new Date(editingEvent.start_date), 'yyyy-MM-dd');
          
          await createException({
            series_id: editingEvent.series_id,
            series_type: 'event',
            exception_date: exceptionDateStr,
            exception_type: 'override',
            override_data: eventData,
            created_by: editingEvent.created_by
          });
          
          console.debug('[EventDialog] Created override exception for:', exceptionDateStr);
        } else if (scope === 'this_and_following') {
          const effectiveRule = (showSeriesOptions && recurrenceOptions.enabled)
            ? recurrenceOptions.rule
            : seriesData?.recurrence_rule;
          
          await splitSeries(editingEvent.series_id, 'event', startDate, {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees,
            family_id: eventData.family_id,
            created_by: editingEvent.created_by,
            recurrence_rule: effectiveRule,
            series_start: eventData.start_date,
            is_active: true
          });
          
          console.debug('[EventDialog] Split series at:', startDate);
        } else {
          const updateData: any = {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
            is_all_day: eventData.is_all_day,
            attendee_profiles: eventData.attendees
          };

          if (showSeriesOptions && recurrenceOptions.enabled) {
            updateData.recurrence_rule = recurrenceOptions.rule;
          }

          const changedFields: string[] = [];
          if (seriesData) {
            if (seriesData.title !== eventData.title) changedFields.push('title');
            if (seriesData.description !== eventData.description) changedFields.push('description');
            if (seriesData.location !== eventData.location) changedFields.push('location');
            if (seriesData.is_all_day !== eventData.is_all_day) changedFields.push('is_all_day');
            if (seriesData.duration_minutes !== updateData.duration_minutes) changedFields.push('duration_minutes');
            const oldAttendees = seriesData.attendee_profiles || [];
            const newAttendees = eventData.attendees || [];
            if (JSON.stringify(oldAttendees.sort()) !== JSON.stringify(newAttendees.sort())) {
              changedFields.push('attendee_profiles');
            }
          }

          console.debug('[EventDialog] Updating all occurrences, changed fields:', changedFields, 'cascade:', shouldApplyToOverrides);
          await updateSeries(editingEvent.series_id, 'event', updateData, shouldApplyToOverrides, changedFields);

          if (typeof window !== 'undefined') {
            const w: any = window;
            setTimeout(() => { if (w.refreshEvents) w.refreshEvents(); }, 300);
          }

          toast({
            title: "Success",
            description: shouldApplyToOverrides 
              ? "Recurring event updated, including previously modified dates"
              : "Recurring event settings updated successfully",
          });

          onOpenChange(false);
          setIsLoading(false);
          return;
        }
      } else if (recurrenceOptions.enabled) {
        const createdBy = editingEvent?.created_by || currentProfileId || currentUserProfileId;
        
        if (!createdBy) {
          toast({
            title: "Error",
            description: "User profile not found for recurring event creation",
            variant: "destructive",
          });
          setIsLoading(false);
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
        
        try {
          const series = await createEventSeries(seriesData);
          
          // Call parent's onSave callback to trigger refresh
          if (onSave) {
            await Promise.resolve(onSave({ 
              ...eventData, 
              series_id: series.id, 
              isRecurring: true 
            }));
          }
        } catch (error: any) {
          const isAuthError = error.message?.includes('permission') || error.message?.includes('policy') || 
                            error.code === '42501' || error.message?.includes('RLS');
          
          toast({
            title: "Error",
            description: isAuthError ? "Please sign in to create events" : "Failed to create recurring event",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      } else {
        if (onSave) {
          await Promise.resolve(onSave(eventData));
        } else {
          const { createEvent } = useEvents(familyId);
          await createEvent(eventData, currentProfileId || currentUserProfileId || '');
        }
      }

      toast({
        title: "Success",
        description: editingEvent ? "Event updated" : "Event created",
      });

      onOpenChange(false);
    } catch (error: any) {
      const isAuthError = error.message?.includes('permission') || error.message?.includes('policy') || 
                        error.code === '42501' || error.message?.includes('RLS');
      
      toast({
        title: "Error",
        description: isAuthError ? "Authentication required" : "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Regular save function for non-recurring events or series edit
  const handleSave = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    if (!user || !session) {
      toast({ title: "Authentication Required", description: "Please sign in to create events.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    
    if (!familyId || !currentProfileId || !title.trim()) {
      toast({
        title: "Error",
        description: !familyId ? "Family ID required" : !currentProfileId ? "User profile not found" : "Event title required",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const calculatedStartDate = isAllDay 
      ? format(startDate, 'yyyy-MM-dd')
      : (() => {
          const year = startDate.getFullYear();
          const month = startDate.getMonth();
          const day = startDate.getDate();
          const [hours, minutes] = startTime.split(':').map(Number);
          return new Date(year, month, day, hours, minutes).toISOString();
        })();
    const calculatedEndDate = isAllDay
      ? format(endDate, 'yyyy-MM-dd')
      : (() => {
          const year = endDate.getFullYear();
          const month = endDate.getMonth();
          const day = endDate.getDate();
          const [hours, minutes] = endTime.split(':').map(Number);
          return new Date(year, month, day, hours, minutes).toISOString();
        })();

    if (new Date(calculatedEndDate) < new Date(calculatedStartDate)) {
      toast({ title: "Error", description: "End date/time cannot be before start date/time", variant: "destructive" });
      setIsLoading(false);
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
      if (recurrenceOptions.enabled && !editingEvent) {
        console.debug('[EventDialog handleSave] Creating new recurring event');
        const createdBy = currentProfileId || currentUserProfileId;
        if (!createdBy) {
          toast({ title: "Error", description: "User profile not found for recurring event creation", variant: "destructive" });
          setIsLoading(false);
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
        
        const series = await createEventSeries(seriesData);
        console.debug('[EventDialog handleSave] Series created:', series.id);
        
        // Close dialog immediately for better UX
        toast({ title: "Success", description: "Recurring event created" });
        onOpenChange(false);
        
        // Trigger refresh asynchronously (non-blocking)
        if (onSave) {
          console.debug('[EventDialog handleSave] Triggering async refresh');
          onSave({ 
            ...eventData, 
            series_id: series.id, 
            isRecurring: true 
          });
        }
        setIsLoading(false);
        return;
      } else if (showSeriesOptions && editingEvent?.series_id) {
        // Editing series directly
        const updateData: any = {
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          duration_minutes: Math.round((new Date(eventData.end_date).getTime() - new Date(eventData.start_date).getTime()) / (1000 * 60)),
          is_all_day: eventData.is_all_day,
          attendee_profiles: eventData.attendees
        };

        if (recurrenceOptions.enabled) {
          updateData.recurrence_rule = recurrenceOptions.rule;
        }

        const changedFields: string[] = [];
        if (seriesData) {
          if (seriesData.title !== eventData.title) changedFields.push('title');
          if (seriesData.description !== eventData.description) changedFields.push('description');
          if (seriesData.location !== eventData.location) changedFields.push('location');
          if (seriesData.is_all_day !== eventData.is_all_day) changedFields.push('is_all_day');
          if (seriesData.duration_minutes !== updateData.duration_minutes) changedFields.push('duration_minutes');
          const oldAttendees = seriesData.attendee_profiles || [];
          const newAttendees = eventData.attendees || [];
          if (JSON.stringify(oldAttendees.sort()) !== JSON.stringify(newAttendees.sort())) {
            changedFields.push('attendee_profiles');
          }
        }

        await updateSeries(editingEvent.series_id, 'event', updateData, applyToOverrides, changedFields);
      } else {
        console.debug('[EventDialog handleSave] Creating non-recurring event');
        if (onSave) {
          await Promise.resolve(onSave(eventData));
        } else {
          const { createEvent } = useEvents(familyId);
          await createEvent(eventData, currentProfileId || currentUserProfileId || '');
        }
      }

      toast({ title: "Success", description: editingEvent ? "Event updated" : "Event created" });
      onOpenChange(false);
    } catch (error: any) {
      const isAuthError = error.message?.includes('permission') || error.message?.includes('policy') || 
                        error.code === '42501' || error.message?.includes('RLS');
      toast({ title: "Error", description: isAuthError ? "Authentication required" : "Failed to save event", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditScopeSelect = (scope: EditScope, shouldApplyToOverrides?: boolean) => {
    setShowEditScope(false);
    handleSaveWithScope(scope, shouldApplyToOverrides || false);
  };

  const handleSubmit = () => {
    // Prevent editing synced events
    if (editingEvent?.source_type && editingEvent.source_type !== 'internal') {
      toast({
        title: "Cannot Edit Synced Event",
        description: `This event is synced from ${editingEvent.source_type === 'google' ? 'Google Calendar' : 'Outlook'}. Edit it there to make changes.`,
        variant: "destructive",
      });
      return;
    }

    if (editingEvent?.isVirtual && editingEvent?.series_id && !showSeriesOptions) {
      // Always show scope dialog for recurring instance edits
      setShowEditScope(true);
      return;
    } else {
      console.log('Not a virtual event or no series_id, calling handleSave directly');
      handleSave();
    }
  };

  const handleDeleteSeries = async () => {
    if (!editingEvent?.series_id) return;
    
    try {
      await deleteSeries(editingEvent.series_id, 'event');
      
      // Trigger calendar refresh
      if (typeof window !== 'undefined' && (window as any).refreshEvents) {
        setTimeout(() => {
          (window as any).refreshEvents();
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
      console.log('Pre-populating form with fresh series data:', seriesData);
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
              {!editingEvent ? 'Create Event' : isEditMode ? 'Edit Event' : title || 'Event Details'}
              {editingEvent?.series_id && (
                <Badge variant="secondary" className="ml-2">
                  <Repeat className="w-3 h-3 mr-1" />
                  Recurring
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* VIEW MODE - Clean minimal design */}
          {editingEvent && !isEditMode && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
                  {editingEvent.source_type && editingEvent.source_type !== 'internal' && (
                    <Badge variant="secondary" className="text-xs">
                      {editingEvent.source_type === 'google' ? (
                        <span className="flex items-center gap-1">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Google
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
                          </svg>
                          Outlook
                        </span>
                      )}
                    </Badge>
                  )}
                </div>
                {editingEvent.series_id && seriesData && (
                  <RecurringEventInfo 
                    rule={seriesData.recurrence_rule}
                    seriesStart={seriesData.series_start}
                    seriesEnd={seriesData.series_end}
                    className="text-sm text-muted-foreground"
                  />
                )}
              </div>

              {/* Date & Time */}
              <div className="flex items-start gap-3 text-sm">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">
                    {format(startDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {isAllDay ? (
                      'All day'
                    ) : (
                      <>
                        {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                        {startDate.getDate() !== endDate.getDate() && (
                          <span className="ml-1">
                            ({format(endDate, 'MMM d')})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              {location && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="text-foreground">{location}</div>
                </div>
              )}

              {/* Attendees */}
              {assignees.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-2">
                    {assignees.map(assigneeId => {
                      const member = familyMembers.find(m => m.id === assigneeId);
                      return member ? (
                        <Badge key={assigneeId} variant="secondary" className="text-xs">
                          {member.display_name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              {description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{description}</p>
                </div>
              )}

              {/* Edit Button - Bottom Right */}
              {(!editingEvent.source_type || editingEvent.source_type === 'internal') && (
                <div className="flex justify-end pt-6">
                  <Button
                    onClick={() => setIsEditMode(true)}
                    className="min-w-[100px]"
                  >
                    Edit
                  </Button>
                </div>
              )}
              
              {/* Message for synced events */}
              {editingEvent.source_type && editingEvent.source_type !== 'internal' && (
                <div className="bg-muted p-4 rounded-lg text-center text-sm text-muted-foreground">
                  This event is synced from {editingEvent.source_type === 'google' ? 'Google Calendar' : 'Outlook'}. Edit it there to make changes.
                </div>
              )}
            </div>
          )}

          {/* EDIT MODE - Form fields */}
          {(!editingEvent || isEditMode) && (
            <div className="space-y-6">
              {/* Enhanced Recurring Event Indicator */}
              {editingEvent?.isVirtual && editingEvent?.series_id && seriesData && !showSeriesOptions && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Repeat className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-900 dark:text-blue-100 text-sm">Repeating Event</span>
              </div>
              <RecurringEventInfo 
                rule={seriesData.recurrence_rule}
                seriesStart={seriesData.series_start}
                seriesEnd={seriesData.series_end}
                className="text-blue-700 dark:text-blue-300 text-xs mb-3"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditSeries}
                  className="text-xs"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Edit Series
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!editingEvent?.series_id || !currentUserProfileId) return;
                    
                    const confirmed = window.confirm(
                      'Skip this event? It will be hidden from your calendar but the rest of the series will continue.'
                    );
                    
                    if (confirmed) {
                      await skipOccurrence(
                        editingEvent.series_id,
                        'event',
                        new Date(editingEvent.start_date),
                        currentUserProfileId
                      );
                      onOpenChange(false);
                    }
                  }}
                  className="text-xs"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Skip This Event
                </Button>
              </div>
            </div>
              )}

              <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className="pointer-events-auto"
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
                className="pointer-events-auto"
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
                className="pointer-events-auto"
              />
            </div>

            <DateTimePickerInline
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
                {onDelete && editingEvent && !isEditMode && (
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
                  onClick={() => {
                    if (editingEvent && isEditMode) {
                      // Cancel editing, go back to view mode
                      setIsEditMode(false);
                    } else {
                      // Close dialog
                      onOpenChange(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isLoading || !title.trim()}
                >
                  {isLoading ? 'Saving...' : (editingEvent && isEditMode ? 'Save' : showSeriesOptions ? 'Update Series' : editingEvent ? 'Update Event' : 'Create Event')}
                </Button>
              </div>
            </div>
            </div>
          )}
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