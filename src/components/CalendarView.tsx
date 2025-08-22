import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Grid3X3, 
  Rows3,
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
  Plus,
  Filter,
  BarChart3,
  Eye,
  Edit,
  Target,
  Users,
  Calendar,
  Sun,
  MapPin
} from 'lucide-react';
import { AddButton } from '@/components/ui/add-button';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addWeeks, 
  addMonths, 
  addDays,
  subWeeks, 
  subMonths, 
  subDays,
  isSameDay,
  isToday,
  isPast,
  isSameMonth
} from 'date-fns';
import { cn, getMemberColorClasses } from '@/lib/utils';
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEvents } from '@/hooks/useEvents';
import { EventDialog } from '@/components/EventDialog';

interface CalendarViewProps {
  tasks: Task[];
  familyMembers: Profile[];
  onTaskUpdated: () => void;
  onCreateTask?: (date: Date) => void;
  onEditTask?: (task: Task) => void;
  familyId?: string;
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
  onTaskUpdated, 
  onCreateTask, 
  onEditTask,
  familyId 
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [filters, setFilters] = useState<TaskFilters>({
    assignedTo: 'all',
    status: 'all',
    taskType: 'all'
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [defaultMember, setDefaultMember] = useState<string>('');
  const { toast } = useToast();
  console.log('CalendarView: familyId passed to useEvents:', familyId);
  const { events, createEvent, refreshEvents } = useEvents(familyId);

  // Get member color classes using the global color system
  const getMemberColors = (member: Profile | null) => {
    if (!member) return {
      bg: 'bg-muted/50',
      border: 'border-muted',
      text: 'text-muted-foreground',
      bgSoft: 'bg-muted/30'
    };
    return getMemberColorClasses(member.color);
  };

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'today') {
      return {
        start: new Date(),
        end: new Date()
      };
    } else if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  }, [currentDate, viewMode]);

  const days = viewMode === 'today' ? [new Date()] : eachDayOfInterval(dateRange);

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter by assigned member
      if (filters.assignedTo !== 'all' && task.assigned_to !== filters.assignedTo) {
        return false;
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
        if (filters.taskType === 'recurring' && !task.is_repeating) return false;
        if (filters.taskType === 'one-time' && task.is_repeating) return false;
      }
      
      return true;
    });
  }, [tasks, filters]);

  // Group filtered tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    
    filteredTasks.forEach(task => {
      if (task.due_date) {
        const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      }
    });
    
    return grouped;
  }, [filteredTasks]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    
    events.forEach(event => {
      if (event.start_date) {
        const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      }
    });
    
    return grouped;
  }, [events]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const currentWeekTasks = filteredTasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return taskDate >= weekStart && taskDate <= weekEnd;
    });

    const completed = currentWeekTasks.filter(t => t.task_completions?.length).length;
    const overdue = currentWeekTasks.filter(t => 
      t.due_date && isPast(new Date(t.due_date)) && !t.task_completions?.length
    ).length;
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
        percentage: memberTasks.length > 0 ? Math.round((memberCompleted / memberTasks.length) * 100) : 0
      };
    });

    return {
      total: currentWeekTasks.length,
      completed,
      pending,
      overdue,
      totalPoints,
      completionRate: currentWeekTasks.length > 0 ? Math.round((completed / currentWeekTasks.length) * 100) : 0,
      memberStats
    };
  }, [filteredTasks, currentDate, familyMembers]);

  // Calculate streaks for recurring tasks
  const calculateStreak = (task: Task) => {
    if (!task.series_id) return 0;
    
    const seriesTasks = tasks.filter(t => t.series_id === task.series_id && t.due_date);
    const sortedTasks = seriesTasks.sort((a, b) => new Date(b.due_date!).getTime() - new Date(a.due_date!).getTime());
    
    let streak = 0;
    for (const t of sortedTasks) {
      const isCompleted = t.task_completions && t.task_completions.length > 0;
      const isDue = new Date(t.due_date!) <= new Date();
      
      if (isCompleted) {
        streak++;
      } else if (isDue) {
        break;
      }
    }
    return streak;
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

  // Handle drag and drop
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newDate = result.destination.droppableId;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: new Date(newDate).toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Rescheduled',
        description: `Task moved to ${format(new Date(newDate), 'MMM d')}`,
      });

      onTaskUpdated();
    } catch (error) {
      console.error('Error rescheduling task:', error);
      toast({
        title: 'Error',
        description: 'Failed to reschedule task',
        variant: 'destructive',
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
    setSelectedEventDate(date);
    setDefaultMember(memberId || '');
    setIsEventDialogOpen(true);
  };

  // Handle task click to edit directly
  const handleTaskClick = (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onEditTask) {
      onEditTask(task);
    }
  };

  // Render task item
  const renderTask = (task: Task, index: number) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
    const streak = calculateStreak(task);
    const assignedMember = familyMembers.find(m => m.id === task.assigned_to);
    const memberColors = getMemberColors(assignedMember);

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={(e) => handleTaskClick(task, e)}
            className={cn(
              "p-2 mb-1 rounded-md border text-xs transition-all hover:shadow-md group",
              onEditTask ? "cursor-pointer hover:ring-2 hover:ring-primary/20" : "cursor-move",
              memberColors.bgSoft,
              memberColors.border,
              isCompleted && "opacity-60 line-through",
              isOverdue && "border-red-300 bg-red-50",
              snapshot.isDragging && "shadow-lg rotate-2"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                {isCompleted && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
                {isOverdue && <Clock className="h-3 w-3 text-red-500 flex-shrink-0" />}
                <span className="truncate">{task.title}</span>
                {onEditTask && <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {task.due_date && (
                  <span className="text-xs opacity-60">
                    {format(new Date(task.due_date), 'HH:mm')}
                  </span>
                )}
                {streak > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    <Flame className="h-2 w-2 mr-1" />
                    {streak}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs h-4 px-1">
                  {task.points}pt
                </Badge>
              </div>
            </div>
            {assignedMember && (
              <div className="flex items-center gap-1 mt-1">
                <UserAvatar
                  name={assignedMember.display_name}
                  color={assignedMember.color}
                  size="sm"
                />
                <span className="text-xs opacity-75">{assignedMember.display_name}</span>
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Family Calendar
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Analytics Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnalytics(!showAnalytics)}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>

              {/* View Mode Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'today' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('today')}
                  className="rounded-r-none"
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  className="rounded-none"
                >
                  <Rows3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                  className="rounded-l-none"
                >
                  <Grid3X3 className="h-4 w-4" />
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
          </div>

          {/* Filters & Analytics */}
          <div className="flex flex-col gap-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={filters.assignedTo} onValueChange={(value) => 
                setFilters(prev => ({ ...prev, assignedTo: value }))
              }>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value: any) => 
                setFilters(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.taskType} onValueChange={(value: any) => 
                setFilters(prev => ({ ...prev, taskType: value }))
              }>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Analytics */}
            {showAnalytics && (
              <Card className="bg-muted/50">
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
                      const familyMember = familyMembers[index];
                      const memberColors = getMemberColors(familyMember);
                      return (
                        <div key={member.name} className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", memberColors.text, memberColors.border)}>
                            {member.name}
                          </Badge>
                          <Progress value={member.percentage} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {member.completed}/{member.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        <div className="text-lg font-semibold">
          {viewMode === 'today' 
            ? `Today - ${format(currentDate, 'EEEE, MMMM d, yyyy')}`
            : viewMode === 'week' 
            ? `Week of ${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
            : format(currentDate, 'MMMM yyyy')
          }
        </div>
      </CardHeader>

      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          {viewMode === 'today' ? (
            // Today View - Member Columns Layout
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">
                  {format(currentDate, 'EEEE, MMMM d')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isToday(currentDate) ? "Today's Schedule" : format(currentDate, 'EEEE') + "'s Schedule"}
                </p>
              </div>
              
              {/* Member Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {familyMembers.map((member) => {
                  const dateKey = format(currentDate, 'yyyy-MM-dd');
                  const memberTasks = (tasksByDate[dateKey] || []).filter(task => 
                    task.assigned_to === member.id || 
                    task.assignees?.some(a => a.profile_id === member.id)
                  );
                  const memberEvents = events.filter(event =>
                    event.attendees?.some((a: any) => a.profile_id === member.id) ||
                    (!event.attendees || event.attendees.length === 0)
                  );
                  const memberColors = getMemberColors(member);

                  return (
                    <Droppable key={member.id} droppableId={member.id}>
                      {(provided, snapshot) => (
                        <Card 
                          className={cn(
                            "transition-colors border-2",
                            memberColors.bgSoft,
                            memberColors.border,
                            snapshot.isDraggingOver && "ring-2 ring-primary/20"
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={member.display_name}
                                color={member.color}
                                size="sm"
                              />
                              <div>
                                <CardTitle className="text-sm">{member.display_name}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                  {memberTasks.length + memberEvents.length} items
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent 
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 min-h-[200px]"
                          >
                            {/* Tasks */}
                            {memberTasks.map((task, index) => renderTask(task, index))}
                            
                           {/* Events */}
                            {events.filter(event => {
                              const eventDate = new Date(event.start_date);
                              return format(eventDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
                            }).map((event) => (
                              <div 
                                key={event.id}
                                className="p-2 mb-1 rounded-md border border-purple-200 bg-purple-50 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-purple-700">{event.title}</span>
                                  <Badge variant="outline" className="text-xs h-4 px-1 border-purple-300 text-purple-600">
                                    Event
                                  </Badge>
                                </div>
                                {event.location && (
                                  <p className="text-xs text-purple-600 mt-1">{event.location}</p>
                                )}
                              </div>
                            ))}
                            
                            {provided.placeholder}
                            
                            {/* Add New Event Button */}
                            <div className="pt-2 border-t border-muted/30">
                              <AddButton
                                className="w-full h-8 text-xs"
                                text="Add Event"
                                showIcon={true}
                                onClick={() => handleCreateEvent(currentDate, member.id)}
                              />
                            </div>
                            
                            {/* Empty State */}
                            {memberTasks.length === 0 && events.filter(event => {
                              const eventDate = new Date(event.start_date);
                              return format(eventDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
                            }).length === 0 && (
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
                  );
                })}
              </div>
            </div>
          ) : (
            // Week/Month Grid View
            <div className={cn(
              "grid gap-2",
              viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'
            )}>
              {/* Day Headers */}
              {days.slice(0, 7).map((day) => (
                <div key={format(day, 'E')} className="p-2 text-center font-medium text-sm border-b">
                  {format(day, 'EEE')}
                </div>
              ))}

              {/* Calendar Days */}
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[dateKey] || [];
                const completedCount = dayTasks.filter(t => t.task_completions?.length).length;
                const totalCount = dayTasks.length;

                return (
                  <Droppable key={dateKey} droppableId={dateKey}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                         onClick={() => handleDayClick(day)}
                         className={cn(
                          "min-h-[120px] p-2 border rounded-md transition-colors cursor-pointer group hover:bg-accent/50",
                          isToday(day) && "bg-blue-50 border-blue-200",
                          !isSameMonth(day, currentDate) && viewMode === 'month' && "opacity-50 bg-gray-50",
                          snapshot.isDraggingOver && "bg-green-50 border-green-300"
                        )}
                      >
                        {/* Day Number & Progress */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-sm font-medium",
                            isToday(day) && "text-blue-600"
                          )}>
                            {format(day, 'd')}
                          </span>
                          
                          {totalCount > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {completedCount}/{totalCount}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Tasks */}
                        <div className="space-y-1">
                          {dayTasks.map((task, index) => renderTask(task, index))}
                          {provided.placeholder}
                        </div>

                        {/* Add Event Button - Always show for days with tasks too */}
                        <div className="mt-2 pt-2 border-t border-muted/50">
                          <AddButton
                            className="w-full h-6 text-xs opacity-0 group-hover:opacity-75 transition-opacity"
                            text="Add Event"
                            showIcon={true}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateEvent(day);
                            }}
                          />
                        </div>

                        {/* Empty State */}
                        {dayTasks.length === 0 && (
                          <div className="flex items-center justify-center h-full min-h-[60px]">
                            {snapshot.isDraggingOver ? (
                              <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed border-green-300 rounded w-full">
                                Drop task here
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          )}
        </DragDropContext>

        {/* Legend & Summary */}
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            <div className="text-sm font-medium">Family Members:</div>
            {familyMembers.map((member) => {
              const memberColors = getMemberColors(member);
              return (
                <Badge 
                  key={member.id} 
                  variant="outline" 
                  className={cn("text-xs", memberColors.text, memberColors.border)}
                >
                  {member.display_name}
                </Badge>
              );
            })}
          </div>
          
        </div>
      </CardContent>

      {/* Event Dialog */}
      <EventDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        familyMembers={familyMembers}
        defaultDate={selectedEventDate || undefined}
        defaultMember={defaultMember}
            onSave={async (eventData) => {
              if (!familyId) return;
              
              try {
                const result = await createEvent({
                  title: eventData.title,
                  description: eventData.description,
                  location: eventData.location,
                  start_date: eventData.start_date,
                  end_date: eventData.end_date,
                  is_all_day: eventData.is_all_day,
                  attendees: eventData.attendees
                });
                
                if (result) {
                  toast({
                    title: 'Success',
                    description: 'Event created successfully',
                  });
                }
                
                await refreshEvents();
                setIsEventDialogOpen(false);
                setSelectedEventDate(null);
                setDefaultMember('');
              } catch (error) {
                console.error('Error creating event:', error);
              }
            }}
      />
    </Card>
  );
};