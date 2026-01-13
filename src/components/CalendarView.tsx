import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Grid3X3, Rows3, CheckCircle2, Clock, Flame, TrendingUp, Plus, Filter, BarChart3, Eye, Edit, Target, Users, Calendar, Sun, MapPin, Repeat, PartyPopper } from 'lucide-react';

// Helper to get source icon for synced events
const getSourceIcon = (sourceType: string | null | undefined) => {
  if (sourceType === 'google') {
    return (
      <span title="Google Calendar">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </span>
    );
  }
  if (sourceType === 'microsoft') {
    return (
      <span title="Outlook">
        <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
        </svg>
      </span>
    );
  }
  return null;
};
import { AddButton } from '@/components/ui/add-button';
import { EventAttendeesDisplay } from '@/components/ui/event-attendees-display';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, addMonths, addDays, subWeeks, subMonths, subDays, isSameDay, isToday, isPast, isSameMonth } from 'date-fns';
import { cn, sanitizeSVG } from '@/lib/utils';
import { useMemberColor } from '@/hooks/useMemberColor';
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEvents } from '@/hooks/useEvents';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { useTaskCompletion } from '@/hooks/useTaskCompletion';
import { useTaskSeries, VirtualTaskInstance } from '@/hooks/useTaskSeries';
import { EventDialog } from '@/components/EventDialog';
import { useCelebrations } from '@/hooks/useCelebrations';
import { usePublicHolidays } from '@/hooks/usePublicHolidays';
import { PublicHolidayBadge } from '@/components/celebrations/PublicHolidayBadge';
import { Cake, Heart, Gift } from 'lucide-react';

import { MemberPinDialog } from '@/components/dashboard/MemberPinDialog';
import { CalendarEvent } from '@/types/event';
interface CalendarViewProps {
  tasks: Task[];
  familyMembers: Profile[];
  profile?: Profile;
  onTaskUpdated: () => void;
  onCreateTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  familyId?: string;
  dashboardMode?: boolean;
  activeMemberId?: string | null;
  onTaskComplete?: (task: Task) => Promise<void>;
}
interface TaskFilters {
  assignedTo: string | 'all';
  status: 'all' | 'completed' | 'pending' | 'overdue';
  taskType: 'all' | 'recurring' | 'one-time';
}
type ViewMode = 'today' | 'week' | 'month';
export const CalendarView = ({
  tasks,
  familyMembers,
  profile,
  onTaskUpdated,
  onCreateTask,
  onEditTask,
  familyId,
  dashboardMode = false,
  activeMemberId,
  onTaskComplete
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [filters, setFilters] = useState<TaskFilters>({
    assignedTo: 'all',
    status: 'all',
    taskType: 'all'
  });
  const [showTasks, setShowTasks] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [defaultMember, setDefaultMember] = useState<string>('');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingTaskCompletion, setPendingTaskCompletion] = useState<Task | null>(null);
  const [memberRequiringPin, setMemberRequiringPin] = useState<Profile | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [optimisticEventUpdates, setOptimisticEventUpdates] = useState<Map<string, CalendarEvent>>(new Map());
  const {
    toast
  } = useToast();
  const {
    events,
    eventSeries, // Track for React dependency
    createEvent,
    updateEvent,
    deleteEvent,
    refreshEvents,
    generateVirtualEvents,
    fetchSeries // For refreshing series on recurring event creation
  } = useEvents(familyId);

  // Initialize task series hook
  const {
    generateVirtualTaskInstances,
    fetchTaskSeries
  } = useTaskSeries(familyId);

  // Auto-refresh events when they change
  React.useEffect(() => {
    // Events are already being tracked, no need for manual refresh
  }, [events]);
  const {
    canPerformAction,
    authenticateMemberPin,
    isAuthenticating
  } = useDashboardAuth();

  // Task completion hook
  const { completeTask: completeTaskHandler, uncompleteTask: uncompleteTaskHandler, isCompleting } = useTaskCompletion({
    currentUserProfile: profile || null,
    activeMemberId,
    isDashboardMode: dashboardMode,
  });

  // Celebrations and public holidays hooks
  const { data: celebrations = [] } = useCelebrations(familyId);
  // Fetch holidays for current year and next 3 years
  const currentYear = new Date().getFullYear();
  const { data: publicHolidays = [] } = usePublicHolidays(familyId, currentYear, currentYear + 3);

  // Helper to get celebrations and holidays for a specific date
  const getCelebrationsAndHolidays = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const monthDay = format(date, 'MM-dd');
    
    // Match celebrations by checking if the current year date matches OR if month-day matches
    const dayCelebrations = celebrations.filter(c => {
      if (!c.celebration_date) return false;
      const celebMonthDay = c.celebration_date.substring(5); // Get MM-DD from YYYY-MM-DD
      return c.currentYearDate === dateStr || celebMonthDay === monthDay;
    });
    
    // Match public holidays by date
    const dayHolidays = publicHolidays.filter(h => {
      if (!h.holiday_date) return false;
      const holidayDate = format(new Date(h.holiday_date), 'yyyy-MM-dd');
      return holidayDate === dateStr;
    });
    
    return { celebrations: dayCelebrations, holidays: dayHolidays };
  }, [celebrations, publicHolidays]);


  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'today') {
      return {
        start: currentDate,
        // Use the selected date, not just "today"
        end: currentDate
      };
    } else if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, {
          weekStartsOn: 0
        }),
        end: endOfWeek(currentDate, {
          weekStartsOn: 0
        })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  }, [currentDate, viewMode]);
  const days = viewMode === 'today' ? [currentDate] : eachDayOfInterval(dateRange);
  
  // For month view, pad the beginning with empty days to align with day of week
  const paddedDays = useMemo(() => {
    if (viewMode !== 'month') return days;
    
    const firstDay = days[0];
    const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Create padding array with null values for days before the month starts
    const padding = Array(dayOfWeek).fill(null);
    
    return [...padding, ...days];
  }, [days, viewMode]);

  // Generate virtual task instances and merge with regular tasks
  const allTasks = useMemo(() => {
    const virtualInstances = generateVirtualTaskInstances(dateRange.start, dateRange.end);
    
    // Get the materialized completions map from window (set by ColumnBasedDashboard)
    const materializedMap = (window as any).__materializedCompletionsMap || new Map();
    
    // Map VirtualTaskInstance to Task format with completion data
    const mappedVirtualTasks: Task[] = virtualInstances.map(vTask => {
      // Check if this virtual instance has been materialized and completed
      const completionKey = `${vTask.series_id}-${vTask.occurrence_date}`;
      const completions = materializedMap.get(completionKey) || [];
      
      return {
        id: vTask.id,
        title: vTask.title,
        description: vTask.description || null,
        points: vTask.points,
        // For virtual tasks, due_date is optional deadline; occurrence_date determines when it appears
        due_date: vTask.due_date,
        assigned_to: vTask.assigned_profiles[0] || null,
        created_by: vTask.created_by,
        completion_rule: vTask.completion_rule as 'any_one' | 'everyone',
        task_group: vTask.task_group,
        recurrence_options: vTask.recurrence_options,
        series_assignee_count: (vTask as any).series_assignee_count,
        // CRITICAL: All virtual task flags must be explicitly set
        isVirtual: true,
        series_id: vTask.series_id,
        occurrence_date: vTask.occurrence_date,
        isException: vTask.isException,
        exceptionType: vTask.exceptionType,
        task_source: 'series',
        task_completions: completions,
        // Map assigned_profiles to assignees format
        assignees: vTask.assigned_profiles.map(profileId => {
          const member = familyMembers.find(m => m.id === profileId);
          return {
            id: `${vTask.id}-${profileId}`,
            profile_id: profileId,
            assigned_at: vTask.occurrence_date, // Use occurrence_date, not due_date
            assigned_by: vTask.created_by,
            profile: member || {
              id: profileId,
              display_name: 'Unknown',
              role: 'child' as const,
              color: 'gray',
              avatar_url: null
            }
          };
        })
      };
    });

    return [...tasks, ...mappedVirtualTasks];
  }, [tasks, dateRange, generateVirtualTaskInstances, familyMembers]);

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      // Filter by assigned member
      if (filters.assignedTo !== 'all') {
        const isAssignedToMember = 
          task.assigned_to === filters.assignedTo || 
          task.assignees?.some(a => a.profile_id === filters.assignedTo);
        if (!isAssignedToMember) return false;
      }

      // Filter by status
      if (filters.status !== 'all') {
        const isCompleted = task.task_completions && task.task_completions.length > 0;
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
        if (filters.status === 'completed' && !isCompleted) return false;
        if (filters.status === 'pending' && (isCompleted || isOverdue)) return false;
        if (filters.status === 'overdue' && !isOverdue) return false;
      }

      // Filter by task type
      if (filters.taskType !== 'all') {
        if (filters.taskType === 'recurring' && !task.isVirtual) return false;
        if (filters.taskType === 'one-time' && task.isVirtual) return false;
      }
      return true;
    });
  }, [allTasks, filters]);

  // Group filtered tasks by date
  const tasksByDate = useMemo(() => {
    // If showTasks is false, return empty object
    if (!showTasks) {
      return {};
    }
    
    const grouped: {
      [key: string]: Task[];
    } = {};
    filteredTasks.forEach(task => {
      // For virtual tasks, use occurrence_date to determine which day they appear on
      // For regular tasks, use due_date if set
      const dateToUse = task.isVirtual && task.occurrence_date 
        ? task.occurrence_date 
        : task.due_date;
      
      if (dateToUse) {
        const dateKey = format(new Date(dateToUse), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      }
    });
    return grouped;
  }, [filteredTasks, showTasks]);

  // Group events by date - handle multi-day events using virtual events with optimistic updates
  const eventsByDate = useMemo(() => {
    const grouped: {
      [key: string]: (CalendarEvent & {
        isMultiDay?: boolean;
        isFirstDay?: boolean;
        isLastDay?: boolean;
        originalStart?: Date;
        originalEnd?: Date;
      })[];
    } = {};

    // Use generateVirtualEvents for combined event + series view
    const allEvents = generateVirtualEvents ? generateVirtualEvents(dateRange.start, dateRange.end) : events;
    
    // ✨ Merge optimistic updates with real events
    const eventsWithOptimistic = allEvents.map((event: CalendarEvent) => 
      optimisticEventUpdates.has(event.id) 
        ? optimisticEventUpdates.get(event.id)! 
        : event
    );
    
    eventsWithOptimistic.forEach((event: CalendarEvent) => {
      if (event.start_date) {
        const startDate = new Date(event.start_date);
        const endDate = event.end_date ? new Date(event.end_date) : startDate;

        // Create events for each day the event spans
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }

          // Add event with indication if it's start, middle, or end of multi-day event
          const isMultiDay = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');
          const isFirstDay = format(currentDate, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd');
          const isLastDay = format(currentDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');
          grouped[dateKey].push({
            ...event,
            isMultiDay,
            isFirstDay,
            isLastDay,
            originalStart: startDate,
            originalEnd: endDate
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });
    return grouped;
  }, [events, eventSeries, generateVirtualEvents, dateRange, optimisticEventUpdates]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const currentWeekTasks = filteredTasks.filter(task => {
      // For virtual tasks, use occurrence_date; for regular tasks, use due_date
      const dateToUse = task.isVirtual && task.occurrence_date 
        ? task.occurrence_date 
        : task.due_date;
      if (!dateToUse) return false;
      const taskDate = new Date(dateToUse);
      const weekStart = startOfWeek(currentDate, {
        weekStartsOn: 0
      });
      const weekEnd = endOfWeek(currentDate, {
        weekStartsOn: 0
      });
      return taskDate >= weekStart && taskDate <= weekEnd;
    });
    const completed = currentWeekTasks.filter(t => t.task_completions?.length).length;
    const overdue = currentWeekTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !t.task_completions?.length).length;
    const pending = currentWeekTasks.length - completed - overdue;
    const totalPoints = currentWeekTasks.reduce((sum, task) => {
      return sum + (task.task_completions?.length ? task.points : 0);
    }, 0);
    const memberStats = familyMembers.map(member => {
      const memberTasks = currentWeekTasks.filter(t => t.assigned_to === member.id);
      const memberCompleted = memberTasks.filter(t => t.task_completions?.length).length;
      return {
        name: member.display_name,
        completed: memberCompleted,
        total: memberTasks.length,
        percentage: memberTasks.length > 0 ? Math.round(memberCompleted / memberTasks.length * 100) : 0
      };
    });
    return {
      total: currentWeekTasks.length,
      completed,
      pending,
      overdue,
      totalPoints,
      completionRate: currentWeekTasks.length > 0 ? Math.round(completed / currentWeekTasks.length * 100) : 0,
      memberStats
    };
  }, [filteredTasks, currentDate, familyMembers]);

  // Calculate streaks for tasks (simplified since recurring tasks are removed)
  const calculateStreak = (task: Task) => {
    return 0; // No streaks without recurring tasks
  };

  // Handle navigation
  const navigatePrevious = () => {
    if (viewMode === 'today') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };
  const navigateNext = () => {
    if (viewMode === 'today') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  // Debounced refresh for smoother UX - increased delay for drag animation
  const debouncedRefresh = useCallback(() => {
    const timer = setTimeout(() => refreshEvents(), 500);
    return () => clearTimeout(timer);
  }, [refreshEvents]);

  // Handle drag and drop with optimistic updates
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const itemId = result.draggableId;
    const newDate = result.destination.droppableId;
    const isEvent = itemId.startsWith('event-');
    
    // Check if it's a virtual task (prevent drag)
    const task = allTasks.find(t => t.id === itemId);
    if (task?.isVirtual) {
      toast({
        title: 'Cannot Move Series Task',
        description: 'Edit the series task to change its schedule',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      if (isEvent) {
        // Handle event drag and drop
        const eventId = itemId.replace('event-', '');
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        // Calculate the new dates maintaining the event duration
        const originalStart = new Date(event.start_date);
        const originalEnd = new Date(event.end_date);
        const duration = originalEnd.getTime() - originalStart.getTime();
        const newStartDate = new Date(newDate);
        // If it's an all-day event, keep the time as start of day
        if (event.is_all_day) {
          newStartDate.setHours(0, 0, 0, 0);
        } else {
          // Preserve the original time
          newStartDate.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds());
        }
        const newEndDate = new Date(newStartDate.getTime() + duration);
        
        // ✨ OPTIMISTIC UPDATE - Update UI immediately
        const updatedEvent = {
          ...event,
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString()
        };
        setOptimisticEventUpdates(prev => new Map(prev).set(eventId, updatedEvent));
        
        // Update database in background
        const {
          error
        } = await supabase.from('events').update({
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString()
        }).eq('id', eventId);
        
        if (error) throw error;
        
        // Debounced refresh - clear optimistic update AFTER refresh completes
        debouncedRefresh();
        
        // Clear optimistic update after delay (ensuring animation completes)
        setTimeout(() => {
          setOptimisticEventUpdates(prev => {
            const next = new Map(prev);
            next.delete(eventId);
            return next;
          });
        }, 600); // Slightly longer than refresh delay
        
            toast({
              title: 'Event Rescheduled',
              description: `${event.title} moved to ${format(newStartDate, 'MMM d')}`,
              duration: 2000
            });
      } else {
        // Handle task drag and drop - UUID validation already done above for virtual tasks
        // Double-check the task ID is a valid UUID before querying
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(itemId)) {
          toast({
            title: 'Cannot Move Task',
            description: 'This task cannot be rescheduled via drag-and-drop.',
            variant: 'destructive'
          });
          return;
        }
        
        const {
          error
        } = await supabase.from('tasks').update({
          due_date: new Date(newDate).toISOString()
        }).eq('id', itemId);
        if (error) throw error;
        toast({
          title: 'Task Rescheduled',
          description: `Task moved to ${format(new Date(newDate), 'MMM d')}`
        });
        onTaskUpdated();
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      
      // ✨ REVERT optimistic update on error
      if (isEvent) {
        const eventId = itemId.replace('event-', '');
        setOptimisticEventUpdates(prev => {
          const next = new Map(prev);
          next.delete(eventId);
          return next;
        });
      }
      
      toast({
        title: 'Error',
        description: 'Failed to reschedule. Changes reverted.',
        variant: 'destructive'
      });
    }
  };

  // Handle day click for task/event creation
  const handleDayClick = (date: Date) => {
    if (onCreateTask) {
      onCreateTask(date);
    }
  };

  // Handle event creation
  const handleCreateEvent = (date: Date, memberId?: string) => {
    setEditingEvent(null);
    setSelectedEventDate(date);
    setDefaultMember(memberId || '');
    setIsEventDialogOpen(true);
  };

  // Handle event editing
  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEventDate(new Date(event.start_date));
    setDefaultMember('');
    setIsEventDialogOpen(true);
  };

  // Handle task completion with PIN protection
  const handleTaskToggle = async (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Prevent action if task is currently being processed
    if (isCompleting(task.id)) {
      console.log('🚫 Task already being processed (calendar):', task.id);
      return;
    }

    // Use dashboard mode completion handler if available
    if (dashboardMode && onTaskComplete) {
      await onTaskComplete(task);
      return;
    }

    // Determine if task is completed by the relevant user
    const completerId = (dashboardMode && activeMemberId) ? activeMemberId : profile?.id;
    if (!completerId) return;

    const isCompleted = task.task_completions?.some(c => c.completed_by === completerId);

    console.log('🔄 Task toggle (calendar):', { 
      taskId: task.id, 
      completerId, 
      isCompleted 
    });

    if (isCompleted) {
      await uncompleteTaskHandler(task, onTaskUpdated);
    } else {
      await completeTaskHandler(task, onTaskUpdated);
    }
  };

  // Handle task click to edit directly
  const handleTaskClick = (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onEditTask) {
      onEditTask(task);
    }
  };

  // Render task item component
  const TaskItem = ({ task, index }: { task: Task; index: number }) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
    const streak = calculateStreak(task);
    const assignedMember = familyMembers.find(m => m.id === task.assigned_to);
    const { styles: colorStyles } = useMemberColor(assignedMember?.color);
    const isDragDisabled = task.isVirtual || false;
    
    return <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
        {(provided, snapshot) => <div 
          ref={provided.innerRef} 
          {...provided.draggableProps} 
          {...provided.dragHandleProps} 
          className={cn(
            "p-2 mb-1 rounded-md text-xs transition-all hover:shadow-md group relative", 
            onEditTask ? "cursor-pointer hover:ring-2 hover:ring-primary/20" : !isDragDisabled && "cursor-move", 
            isCompleted && "opacity-60 line-through", 
            isOverdue && "ring-1 ring-destructive/50", 
            snapshot.isDragging && "shadow-lg rotate-2", 
            isDragDisabled && "cursor-pointer"
          )}
          style={isCompleted ? colorStyles.bg20 : colorStyles.bg50}
        >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0" onClick={e => handleTaskClick(task, e)}>
                <button onClick={e => handleTaskToggle(task, e)} className={cn("h-3 w-3 flex-shrink-0 rounded-full border transition-colors hover:scale-110", isCompleted ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400")}>
                  {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                </button>
                {isOverdue && <Clock className="h-3 w-3 text-red-500 flex-shrink-0" />}
                {task.isVirtual && <Repeat className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                <span className="truncate">{task.title}</span>
                {onEditTask && <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {task.due_date && <span className="text-xs opacity-60">
                    {format(new Date(task.due_date), 'HH:mm')}
                  </span>}
                {streak > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">
                    <Flame className="h-2 w-2 mr-1" />
                    {streak}
                  </Badge>}
                <Badge variant="outline" className="text-xs h-4 px-1">
                  {task.points}pt
                </Badge>
              </div>
            </div>
            {assignedMember && <div className="flex items-center gap-1 mt-1">
                <UserAvatar name={assignedMember.display_name} color={assignedMember.color} avatarIcon={assignedMember.avatar_url || undefined} size="sm" />
                <span className="text-xs opacity-75">{assignedMember.display_name}</span>
              </div>}
          </div>}
      </Draggable>;
  };
  return <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4">
          {/* Date Heading */}
          <h2 className="text-3xl sm:text-4xl font-bold">
            {viewMode === 'today' ? `Today - ${format(currentDate, 'EEEE, MMMM d, yyyy')}` : viewMode === 'week' ? `Week of ${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}` : format(currentDate, 'MMMM yyyy')}
          </h2>

          {/* Header Row with View Mode, Navigation, and Filters */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex border rounded-md">
                <Button variant={viewMode === 'today' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('today')} className="rounded-r-none gap-2">
                  <Sun className="h-4 w-4" />
                  <span className="hidden sm:inline">Day</span>
                </Button>
                <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-none gap-2">
                  <Rows3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Week</span>
                </Button>
                <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="rounded-l-none gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Month</span>
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={navigatePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={navigateNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <Select value={filters.assignedTo} onValueChange={value => setFilters(prev => ({
              ...prev,
              assignedTo: value
            }))}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {familyMembers.map(member => <SelectItem key={member.id} value={member.id}>
                      {member.display_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value: any) => setFilters(prev => ({
              ...prev,
              status: value
            }))}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.taskType} onValueChange={(value: any) => setFilters(prev => ({
              ...prev,
              taskType: value
            }))}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="recurring">Series</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="show-tasks" 
                  checked={showTasks}
                  onCheckedChange={(checked) => setShowTasks(checked as boolean)}
                />
                <Label htmlFor="show-tasks" className="text-xs cursor-pointer whitespace-nowrap">
                  Tasks
                </Label>
              </div>
            </div>
          </div>


          {/* Debug Panel */}
            {showDebugInfo && process.env.NODE_ENV === 'development' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="text-sm space-y-2">
                    <div><strong>Date Range:</strong> {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d')}</div>
                    <div><strong>Total Events:</strong> {generateVirtualEvents ? generateVirtualEvents(dateRange.start, dateRange.end).length : events.length}</div>
                    <div><strong>Family ID:</strong> {familyId || 'Not set'}</div>
                    <div><strong>Dashboard Mode:</strong> {dashboardMode ? 'Yes' : 'No'}</div>
                    <div><strong>Active Member ID:</strong> {activeMemberId || 'Not set'}</div>
                    <div><strong>Profile ID:</strong> {profile?.id || 'Not set'}</div>
                    <div><strong>Profile Name:</strong> {profile?.display_name || 'Not set'}</div>
                    {viewMode === 'today' && (
                      <div>
                        <strong>Today's Events:</strong> {eventsByDate[format(currentDate, 'yyyy-MM-dd')]?.length || 0}
                        {eventsByDate[format(currentDate, 'yyyy-MM-dd')]?.map(e => (
                          <div key={e.id} className="ml-4 text-xs">
                            • {e.title} {e.attendees?.length ? `(${e.attendees.length} attendees)` : '(no attendees)'}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-blue-600">All events now show for all members in today view.</div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Analytics */}
            {showAnalytics && <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{analytics.completed}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{analytics.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{analytics.overdue}</div>
                      <div className="text-xs text-muted-foreground">Overdue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{analytics.totalPoints}</div>
                      <div className="text-xs text-muted-foreground">Points Earned</div>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Member Progress</div>
                    {analytics.memberStats.map((member, index) => {
                  const MemberProgress = () => {
                    const familyMember = familyMembers[index];
                    const { styles: colorStyles } = useMemberColor(familyMember?.color);
                    return <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs" style={{ ...colorStyles.text, ...colorStyles.border }}>
                            {member.name}
                          </Badge>
                          <Progress value={member.percentage} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {member.completed}/{member.total}
                          </span>
                        </div>;
                  };
                  return <MemberProgress key={member.name} />;
                 })}
                  </div>
                </CardContent>
              </Card>}
        </div>
      </CardHeader>

      <CardContent className="column-card-content">
        <DragDropContext onDragEnd={handleDragEnd}>
          {viewMode === 'today' ?
        // Today View - Single Row Member Columns Layout
        <div className="column-content-padding space-y-4">
              {/* Mobile: Single column carousel */}
              <div className="block md:hidden">
                <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                  <div className="flex gap-4 pb-4">
                    {/* Celebrations Column */}
                    {(() => {
                      const { celebrations: dayCelebrations, holidays: dayHolidays } = getCelebrationsAndHolidays(currentDate);
                      return (dayCelebrations.length > 0 || dayHolidays.length > 0) && (
                        <div className="snap-center shrink-0 w-[calc(100vw-2rem)]">
                          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                            <CardHeader className="pb-3 border-b">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <PartyPopper className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-base sm:text-lg">Celebrations & Holidays</CardTitle>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-6">
                              {dayCelebrations.map(celebration => {
                                const Icon = celebration.celebration_type === 'birthday' ? Cake : 
                                            celebration.celebration_type === 'anniversary' ? Heart : Gift;
                                return (
                                  <div key={celebration.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-sm">
                                    {/* Photo or Icon */}
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                                      {celebration.visual_type === 'photo' && celebration.photo_url ? (
                                        <img src={celebration.photo_url} alt={celebration.name} className="w-full h-full object-cover" />
                                      ) : celebration.visual_type === 'icon' && celebration.icon ? (
                                        <div className="w-5 h-5 text-primary" dangerouslySetInnerHTML={{ __html: sanitizeSVG(celebration.icon.svg_content) }} />
                                      ) : (
                                        <Icon className="h-5 w-5 text-primary" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium">{celebration.name}</div>
                                      {celebration.age && (
                                        <div className="text-sm text-muted-foreground">Turning {celebration.age}</div>
                                      )}
                                    </div>
                                    {celebration.age && <Badge variant="secondary">{celebration.age}</Badge>}
                                  </div>
                                );
                              })}
                              {dayHolidays.map(holiday => (
                                <div key={holiday.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-sm">
                                  <span className="text-2xl">{holiday.flag_emoji}</span>
                                  <div className="font-medium">{holiday.holiday_name}</div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}
                    
                    {familyMembers.map(member => {
                      const MemberColumn = () => {
                        const { styles: colorStyles } = useMemberColor(member.color);
                        const dateKey = format(currentDate, 'yyyy-MM-dd');
                        const memberTasks = (tasksByDate[dateKey] || []).filter(task => task.assigned_to === member.id || task.assignees?.some(a => a.profile_id === member.id));
                        const memberEvents = (eventsByDate[dateKey] || []).filter(event => {
                          const hasAttendees = event.attendees && event.attendees.length > 0;
                          const isAssignedToMember = hasAttendees && event.attendees.some((a: any) => a.profile_id === member.id);
                          const showForAll = !hasAttendees;
                          return showForAll || isAssignedToMember;
                        });
                        
                        return (
                          <div className="snap-center shrink-0 w-[calc(100vw-2rem)]">
                            <Droppable droppableId={member.id}>
                              {(provided, snapshot) => (
                                <Card 
                                  className={cn("transition-colors", snapshot.isDraggingOver && "ring-2 ring-primary/20")}
                                  style={colorStyles.bg10}
                                >
                                  <CardHeader 
                                    className="pb-3 border-b"
                                    style={colorStyles.border}
                                  >
                                    <div className="flex items-center gap-3">
                                      <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="md" className="sm:h-10 sm:w-10" />
                                      <div className="min-w-0 flex-1">
                                        <CardTitle className="text-base sm:text-lg truncate">{member.display_name}</CardTitle>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  
                                  <CardContent ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[200px] pt-6">
                                    {memberTasks.map((task, index) => <TaskItem key={task.id} task={task} index={index} />)}
                                    {memberEvents.map((event, eventIndex) => {
                                      const isDragDisabled = event.isMultiDay ? !event.isFirstDay : false;
                                      return (
                                        <Draggable 
                                          key={`event-${event.id}-${format(currentDate, 'yyyy-MM-dd')}`} 
                                          draggableId={`event-${event.id}`} 
                                          index={memberTasks.length + eventIndex}
                                          isDragDisabled={isDragDisabled}
                                        >
                                           {(provided, snapshot) => (
                                             <div 
                                               ref={provided.innerRef} 
                                               {...provided.draggableProps} 
                                               {...provided.dragHandleProps} 
                                               className={cn(
                                                 "group p-3 mb-1 rounded-md bg-card shadow-sm hover:shadow-md transition-all", 
                                                 !isDragDisabled && "cursor-move",
                                                 isDragDisabled && "cursor-not-allowed opacity-70",
                                                 snapshot.isDragging && "shadow-lg rotate-2 z-[9999]"
                                               )}
                                               onClick={() => handleEditEvent(event)}
                                             >
                                               <div className="flex items-center justify-between">
                                                 <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                   <span className="font-medium text-sm text-foreground truncate">{event.title}</span>
                                                   {event.source_type && getSourceIcon(event.source_type)}
                                                 </div>
                                                 <div className="flex items-center gap-1 flex-shrink-0">
                                                   <Badge variant="outline" className="text-xs h-4 px-1">
                                                     {event.isMultiDay ? 'Multi' : 'Event'}
                                                   </Badge>
                                                   <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-muted-foreground" />
                                                 </div>
                                               </div>
                                               {event.location && (
                                                 <div className="flex items-center gap-1 mt-2">
                                                   <MapPin className="h-3 w-3 text-muted-foreground" />
                                                   <p className="text-xs text-muted-foreground">{event.location}</p>
                                                 </div>
                                               )}
                                               {event.start_date && (
                                                 <div className="flex items-center gap-1 mt-2">
                                                   <Clock className="h-3 w-3 text-muted-foreground" />
                                                   <p className="text-xs text-muted-foreground">
                                                     {event.is_all_day ? 'All day' : format(new Date(event.start_date), 'HH:mm')}
                                                   </p>
                                                 </div>
                                               )}
                                             </div>
                                           )}
                                        </Draggable>
                                      );
                                    })}
                                    {provided.placeholder}
                                    <div className="pt-2 border-t border-muted/30">
                                      <AddButton className="w-full h-8 text-xs" text="Add Event" showIcon={true} onClick={() => handleCreateEvent(currentDate, member.id)} />
                                    </div>
                                    {memberTasks.length === 0 && memberEvents.length === 0 && (
                                      <div className="text-center py-8">
                                        <div className="text-xs text-muted-foreground">
                                          No items for {isToday(currentDate) ? 'today' : 'this day'}
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Droppable>
                          </div>
                        );
                      };
                      return <MemberColumn key={member.id} />;
                    })}
                  </div>
                </div>
              </div>

              {/* Desktop/Tablet: Responsive grid on large screens, scrolling on medium */}
              <div className="hidden md:block">
                <div className="md:overflow-x-auto xl:overflow-x-visible">
                  <div className="flex xl:grid xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4 pb-4 md:min-w-fit xl:min-w-0">
                    {/* Celebrations Column */}
                    {(() => {
                      const { celebrations: dayCelebrations, holidays: dayHolidays } = getCelebrationsAndHolidays(currentDate);
                      return (dayCelebrations.length > 0 || dayHolidays.length > 0) && (
                        <div className="md:shrink-0 md:w-64 md:min-w-[16rem] md:max-w-[20rem] xl:shrink xl:w-auto xl:min-w-0 xl:max-w-none">
                          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                            <CardHeader className="pb-3 border-b">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <PartyPopper className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-base sm:text-lg">Celebrations</CardTitle>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-6 min-h-[200px]">
                              {dayCelebrations.map(celebration => {
                                const Icon = celebration.celebration_type === 'birthday' ? Cake : 
                                            celebration.celebration_type === 'anniversary' ? Heart : Gift;
                                return (
                                  <div key={celebration.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-sm">
                                    {/* Photo or Icon */}
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                                      {celebration.visual_type === 'photo' && celebration.photo_url ? (
                                        <img src={celebration.photo_url} alt={celebration.name} className="w-full h-full object-cover" />
                                      ) : celebration.visual_type === 'icon' && celebration.icon ? (
                                        <div className="w-5 h-5 text-primary" dangerouslySetInnerHTML={{ __html: sanitizeSVG(celebration.icon.svg_content) }} />
                                      ) : (
                                        <Icon className="h-5 w-5 text-primary" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium">{celebration.name}</div>
                                      {celebration.age && (
                                        <div className="text-sm text-muted-foreground">Turning {celebration.age}</div>
                                      )}
                                    </div>
                                    {celebration.age && <Badge variant="secondary">{celebration.age}</Badge>}
                                  </div>
                                );
                              })}
                              {dayHolidays.map(holiday => (
                                <div key={holiday.id} className="flex items-center gap-3 p-3 bg-card rounded-lg shadow-sm">
                                  <span className="text-2xl">{holiday.flag_emoji}</span>
                                  <div className="font-medium">{holiday.holiday_name}</div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}
                    
                    {familyMembers.map(member => {
                    const MemberColumn = () => {
                      const { styles: colorStyles } = useMemberColor(member.color);
                      const dateKey = format(currentDate, 'yyyy-MM-dd');
                      const memberTasks = (tasksByDate[dateKey] || []).filter(task => task.assigned_to === member.id || task.assignees?.some(a => a.profile_id === member.id));
                      const memberEvents = (eventsByDate[dateKey] || []).filter(event => {
                        const hasAttendees = event.attendees && event.attendees.length > 0;
                        const isAssignedToMember = hasAttendees && event.attendees.some((a: any) => a.profile_id === member.id);
                        const showForAll = !hasAttendees;
                        return showForAll || isAssignedToMember;
                      });
                      
                      return (
                        <div className="md:shrink-0 md:w-64 md:min-w-[16rem] md:max-w-[20rem] xl:shrink xl:w-auto xl:min-w-0 xl:max-w-none">
                          <Droppable droppableId={member.id}>
                            {(provided, snapshot) => <Card
                        className={cn("transition-colors", snapshot.isDraggingOver && "ring-2 ring-primary/20")}
                        style={colorStyles.bg10}
                      >
                          <CardHeader 
                            className="pb-3 border-b"
                            style={colorStyles.border}
                          >
                            <div className="flex items-center gap-3">
                              <UserAvatar name={member.display_name} color={member.color} avatarIcon={member.avatar_url || undefined} size="md" className="sm:h-10 sm:w-10" />
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-base sm:text-lg truncate">{member.display_name}</CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[200px] pt-6">
                            {/* Tasks */}
                            {memberTasks.map((task, index) => <TaskItem key={task.id} task={task} index={index} />)}
                            
                             {/* Events */}
                             {memberEvents.map((event, eventIndex) => {
                               const isDragDisabled = event.isMultiDay ? !event.isFirstDay : false;
                               
                               return <Draggable 
                                 key={`event-${event.id}-${format(currentDate, 'yyyy-MM-dd')}`} 
                                 draggableId={`event-${event.id}`} 
                                 index={memberTasks.length + eventIndex}
                                 isDragDisabled={isDragDisabled}
                               >
                                  {(provided, snapshot) => <div 
                                    ref={provided.innerRef} 
                                    {...provided.draggableProps} 
                                    {...provided.dragHandleProps} 
                                    className={cn(
                                      "group p-3 mb-1 rounded-md bg-card shadow-sm hover:shadow-md transition-all", 
                                      !isDragDisabled && "cursor-move",
                                      isDragDisabled && "cursor-not-allowed opacity-70",
                                      snapshot.isDragging && "shadow-lg rotate-2 z-[9999]"
                                    )}
                                    onClick={() => handleEditEvent(event)}
                                  >
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                     <span className="font-medium text-sm text-foreground truncate">{event.title}</span>
                                     {event.source_type && getSourceIcon(event.source_type)}
                                   </div>
                                   <div className="flex items-center gap-1 flex-shrink-0">
                                    <Badge variant="outline" className="text-xs h-4 px-1">
                                      {event.isMultiDay ? 'Multi' : 'Event'}
                                    </Badge>
                                     <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-muted-foreground" />
                                   </div>
                                 </div>
                                 {event.location && <div className="flex items-center gap-1 mt-2">
                                     <MapPin className="h-3 w-3 text-muted-foreground" />
                                     <p className="text-xs text-muted-foreground">{event.location}</p>
                                   </div>}
                                 {event.start_date && <div className="flex items-center gap-1 mt-2">
                                     <Clock className="h-3 w-3 text-muted-foreground" />
                                     <p className="text-xs text-muted-foreground">
                                       {event.is_all_day ? 'All day' : format(new Date(event.start_date), 'HH:mm')}
                                     </p>
                                   </div>}
                                </div>}
                              </Draggable>
                             })}
                             
                             {provided.placeholder}
                            
                            {/* Add New Event Button */}
                            <div className="pt-2 border-t border-muted/30">
                              <AddButton className="w-full h-8 text-xs" text="Add Event" showIcon={true} onClick={() => handleCreateEvent(currentDate, member.id)} />
                            </div>
                            
                            {/* Empty State */}
                            {memberTasks.length === 0 && memberEvents.length === 0 && <div className="text-center py-8">
                                <div className="text-xs text-muted-foreground">
                                  No items for {isToday(currentDate) ? 'today' : 'this day'}
                                </div>
                              </div>}
                          </CardContent>
                        </Card>}
                          </Droppable>
                        </div>
                      );
                    };
                    return <MemberColumn key={member.id} />;
                    })}
                  </div>
                </div>
              </div>
            </div> :
        // Week/Month Grid View
        <div className={cn("grid gap-2", viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7')}>
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => <div key={dayName} className="p-2 text-center font-medium text-sm border-b">
                  {dayName}
                </div>)}

              {/* Calendar Days */}
              {(viewMode === 'month' ? paddedDays : days).map((day, index) => {
            // Handle padding days (null values)
            if (day === null) {
              return <div key={`padding-${index}`} className="min-h-[120px] p-2 border rounded-md bg-muted/20" />;
            }
            
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[dateKey] || [];
            const dayEvents = eventsByDate[dateKey] || [];
            const completedCount = dayTasks.filter(t => t.task_completions?.length).length;
            const totalCount = dayTasks.length;
            return <Droppable key={dateKey} droppableId={dateKey}>
                    {(provided, snapshot) => <div ref={provided.innerRef} {...provided.droppableProps} onClick={() => handleDayClick(day)} className={cn("min-h-[120px] p-2 border rounded-md transition-all cursor-pointer group hover:bg-accent/50", isToday(day) && "bg-blue-50 border-blue-200", !isSameMonth(day, currentDate) && viewMode === 'month' && "opacity-50 bg-gray-50", snapshot.isDraggingOver && "bg-green-50/50 border-green-400 scale-[1.01] shadow-lg ring-2 ring-green-300/40")}>

                        {/* Day Number & Progress */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("text-sm font-medium", isToday(day) && "text-blue-600")}>
                            {format(day, 'd')}
                          </span>
                          
                          {totalCount > 0 && <div className="flex items-center gap-1">
                              <div className="w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 transition-all" style={{
                        width: `${completedCount / totalCount * 100}%`
                      }} />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {completedCount}/{totalCount}
                              </span>
                            </div>}
                        </div>

                        {/* Tasks and Events */}
                        <div className="space-y-1 relative">
                          {/* Drag Over Indicator */}
                          {snapshot.isDraggingOver && (dayTasks.length > 0 || dayEvents.length > 0) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 border-2 border-dashed border-green-300 rounded z-10">
                              <span className="text-sm text-green-700 font-medium">Drop event here</span>
                            </div>
                          )}
                          
                          {/* Celebrations and Holidays */}
                          {(() => {
                            const { celebrations: dayCelebrations, holidays: dayHolidays } = getCelebrationsAndHolidays(day);
                            return (dayCelebrations.length > 0 || dayHolidays.length > 0) && (
                              <div className="mb-2 space-y-1">
                                {dayCelebrations.map(celebration => {
                                  const Icon = celebration.celebration_type === 'birthday' ? Cake : 
                                              celebration.celebration_type === 'anniversary' ? Heart : Gift;
                                  return (
                                    <div key={celebration.id} className="flex items-center gap-1 text-xs bg-primary/10 rounded px-1.5 py-0.5">
                                      {celebration.visual_type === 'photo' && celebration.photo_url ? (
                                        <img src={celebration.photo_url} alt={celebration.name} className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
                                      ) : celebration.visual_type === 'icon' && celebration.icon ? (
                                        <div className="h-3 w-3 text-primary flex-shrink-0" dangerouslySetInnerHTML={{ __html: sanitizeSVG(celebration.icon.svg_content) }} />
                                      ) : (
                                        <Icon className="h-3 w-3 text-primary flex-shrink-0" />
                                      )}
                                      <span className="truncate font-medium">{celebration.name}</span>
                                    </div>
                                  );
                                })}
                                {dayHolidays.map(holiday => (
                                  <div key={holiday.id} className="flex items-center gap-1 text-xs bg-muted rounded px-1.5 py-0.5">
                                    <span>{holiday.flag_emoji}</span>
                                    <span className="truncate">{holiday.holiday_name}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          
                          {dayTasks.map((task, index) => <TaskItem key={task.id} task={task} index={index} />)}
                          
                           {/* Events */}
                           {dayEvents.map((event, eventIndex) => {
                              const isDragDisabled = event.isMultiDay ? !event.isFirstDay : false;
                              
                              // Determine background color based on attendees
                              const attendeeCount = event.attendees?.length || 0;
                              const singleMember = attendeeCount === 1 ? familyMembers.find(m => m.id === event.attendees[0].profile_id) : null;
                              
                              const EventCard = () => {
                                const memberColorData = singleMember ? useMemberColor(singleMember.color) : null;
                                
                                // Create background style based on attendee count
                                let bgStyle: React.CSSProperties = {};
                                if (attendeeCount === 0) {
                                  // No attendees - white background
                                  bgStyle = { backgroundColor: 'hsl(var(--card))' };
                                } else if (attendeeCount === 1 && memberColorData) {
                                  // Single member - use member color at 30% opacity
                                  const hex = memberColorData.hex;
                                  bgStyle = { backgroundColor: `${hex}4D` }; // 4D in hex = 77/255 = ~30% opacity
                                } else {
                                  // Multiple members - light grey
                                  bgStyle = { backgroundColor: 'hsl(var(--muted))' };
                                }
                                
                                return (
                                  <Draggable 
                                    key={`event-${event.id}-${dateKey}`} 
                                    draggableId={`event-${event.id}`} 
                                    index={dayTasks.length + eventIndex}
                                    isDragDisabled={isDragDisabled}
                                  >
                                     {(provided, snapshot) => <div 
                                       ref={provided.innerRef} 
                                       {...provided.draggableProps} 
                                       {...provided.dragHandleProps} 
                                       className={cn(
                                         "group p-3 mb-1 hover:shadow-md transition-all shadow-sm", 
                                         event.isMultiDay && !event.isFirstDay && !event.isLastDay && "rounded-none", 
                                         event.isMultiDay && event.isFirstDay && "rounded-r-none", 
                                         event.isMultiDay && event.isLastDay && "rounded-l-none", 
                                         !event.isMultiDay && "rounded-md",
                                         !isDragDisabled && "cursor-move",
                                         isDragDisabled && "cursor-not-allowed opacity-70",
                                         snapshot.isDragging && "shadow-lg rotate-2 scale-105 z-[9999]"
                                       )}
                                       style={bgStyle}
                                       onClick={e => {
                                         e.stopPropagation();
                                         handleEditEvent(event);
                                       }}>
                                       <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                           <span className="font-medium text-sm text-foreground truncate">
                                             {event.isMultiDay && !event.isFirstDay ? `↳ ${event.title}` : event.title}
                                           </span>
                                           {event.source_type && getSourceIcon(event.source_type)}
                                         </div>
                                         <div className="flex items-center gap-1 shrink-0">
                                           <Badge variant="outline" className="text-xs h-4 px-1">
                                             {event.isMultiDay ? 'Multi' : event.recurrence_options?.enabled || event.isVirtual ? 'Series' : 'Single'}
                                           </Badge>
                                           <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity text-muted-foreground" />
                                         </div>
                                       </div>
                                      
                                      {/* Attendees Display */}
                                      {event.attendees && event.attendees.length > 0 && <div className="mt-2">
                                          <EventAttendeesDisplay attendees={event.attendees} showNames={false} maxDisplay={99} />
                                        </div>}
                                      
                                      {/* Time Display - only show on first day or single day events */}
                                      {(!event.isMultiDay || event.isFirstDay) && event.start_date && <div className="flex items-center gap-1 mt-2">
                                          <Clock className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs text-muted-foreground">
                                            {event.is_all_day ? 'All day' : format(new Date(event.start_date), 'HH:mm')}
                                            {event.isMultiDay && ` - ${format(new Date(event.originalEnd), 'MMM d')}`}
                                          </span>
                                          {/* Recurrence Indicator */}
                                          {event.recurrence_options?.enabled && <Badge variant="outline" className="text-xs h-4 px-1 border-purple-300 text-purple-600 ml-1">
                                              <Repeat className="h-2.5 w-2.5 mr-0.5" />
                                              Series
                                            </Badge>}
                                        </div>}
                                    </div>}
                                  </Draggable>
                                );
                              };
                              
                              return <EventCard key={`event-${event.id}-${dateKey}`} />;
                           })}
                           
                           {/* Empty State Drag Indicator */}
                           {(dayTasks.length === 0 && dayEvents.length === 0) && snapshot.isDraggingOver && (
                             <div className="text-center text-sm text-green-700 font-medium py-4 border-2 border-dashed border-green-300 rounded bg-green-50/50">
                               Drop event here
                             </div>
                           )}
                           
                           {provided.placeholder}
                         </div>

                        {/* Add Event Button - Always show for days with tasks too */}
                        <div className="mt-2 pt-2 border-t border-muted/50">
                          <AddButton className="w-full h-6 text-xs opacity-0 group-hover:opacity-75 transition-opacity" text="Add Event" showIcon={true} onClick={e => {
                    e.stopPropagation();
                    handleCreateEvent(day);
                  }} />
                        </div>

                      </div>}
                  </Droppable>;
          })}
            </div>}
        </DragDropContext>

        {/* Legend & Summary */}
        
      </CardContent>

      {/* Event Dialog */}
      <EventDialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen} familyMembers={familyMembers} familyId={familyId} defaultDate={selectedEventDate || undefined} currentProfileId={activeMemberId || profile?.id} defaultMember={defaultMember} editingEvent={editingEvent} onSave={async eventData => {
      if (!familyId) return;
      try {
        const currentProfileId = activeMemberId || profile?.id;
        console.log('CalendarView onSave - using profile ID:', currentProfileId);
        console.log('CalendarView onSave - familyId:', familyId);
        console.log('CalendarView onSave - profile object:', profile);
        console.log('CalendarView onSave - activeMemberId:', activeMemberId);
        if (!currentProfileId) {
          console.error('No profile ID available for event creation');
          toast({
            title: 'Error',
            description: 'Unable to determine event creator - please ensure you\'re logged in',
            variant: 'destructive'
          });
          return;
        }
        if (editingEvent) {
          // Update existing event
          await updateEvent(editingEvent.id, {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            is_all_day: eventData.is_all_day,
            recurrence_options: eventData.recurrence_options
          }, eventData.attendees);
          toast({
            title: 'Success',
            description: 'Event updated successfully'
          });
        } else if (eventData.isRecurring) {
          // Handle recurring event (series already created in dialog)
          console.debug('[CalendarView onSave] Recurring event created with series_id:', eventData.series_id);
          
          // Parallelize series fetch and event refresh for faster update
          await Promise.all([
            fetchSeries(),
            refreshEvents()
          ]);
          
          console.debug('[CalendarView onSave] Series and events refreshed');
        } else {
          // Create new event - MUST pass the currentProfileId
          console.log('Creating event from main calendar with creator:', currentProfileId);
          const result = await createEvent({
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            is_all_day: eventData.is_all_day,
            attendees: eventData.attendees,
            recurrence_options: eventData.recurrence_options
          }, currentProfileId);

          if (result) {
            console.log('Event created successfully from main calendar');
            toast({
              title: 'Success',
              description: 'Event created successfully'
            });
          }
          await refreshEvents();
        }
        console.debug('[CalendarView onSave] Closing dialog');
        setIsEventDialogOpen(false);
        setSelectedEventDate(null);
        setDefaultMember('');
        setEditingEvent(null);
      } catch (error) {
        console.error('Error saving event:', error);
        toast({
          title: 'Error',
          description: 'Failed to save event',
          variant: 'destructive'
        });
      }
    }} onDelete={editingEvent ? async () => {
      try {
        await deleteEvent(editingEvent.id);
        toast({
          title: 'Success',
          description: 'Event deleted successfully'
        });
        await refreshEvents();
        setIsEventDialogOpen(false);
        setEditingEvent(null);
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    } : undefined} />

      {/* PIN Dialog for Task Completion */}
      {memberRequiringPin && <MemberPinDialog open={pinDialogOpen} onOpenChange={open => {
      setPinDialogOpen(open);
      if (!open) {
        setPendingTaskCompletion(null);
        setMemberRequiringPin(null);
      }
    }} member={memberRequiringPin} onSuccess={async () => {
      if (pendingTaskCompletion) {
        await completeTaskHandler(pendingTaskCompletion, onTaskUpdated);
        setPendingTaskCompletion(null);
        setMemberRequiringPin(null);
      }
    }} onAuthenticate={async (pin: string) => {
      if (memberRequiringPin) {
        return await authenticateMemberPin(memberRequiringPin.id, pin);
      }
      return false;
    }} isAuthenticating={isAuthenticating} action="complete this task" />}
    </Card>;
};