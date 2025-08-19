import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Grid3X3, 
  Rows3,
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addWeeks, 
  addMonths, 
  subWeeks, 
  subMonths, 
  isSameDay,
  isToday,
  isPast,
  isSameMonth
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Task, Profile } from '@/types/task';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarViewProps {
  tasks: Task[];
  familyMembers: Profile[];
  onTaskUpdated: () => void;
}

type ViewMode = 'week' | 'month';

// Generate colors for family members
const memberColors = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200', 
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
];

export const CalendarView = ({ tasks, familyMembers, onTaskUpdated }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const { toast } = useToast();

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
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

  const days = eachDayOfInterval(dateRange);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    
    tasks.forEach(task => {
      if (task.due_date) {
        const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      }
    });
    
    return grouped;
  }, [tasks]);

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
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
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

  // Get member color
  const getMemberColor = (memberId: string | null) => {
    if (!memberId) return 'bg-gray-100 text-gray-800 border-gray-200';
    const index = familyMembers.findIndex(m => m.id === memberId);
    return memberColors[index % memberColors.length];
  };

  // Render task item
  const renderTask = (task: Task, index: number) => {
    const isCompleted = task.task_completions && task.task_completions.length > 0;
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
    const streak = calculateStreak(task);
    const assignedMember = familyMembers.find(m => m.id === task.assigned_to);

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "p-2 mb-1 rounded-md border text-xs cursor-move transition-all",
              getMemberColor(task.assigned_to),
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
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
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
                <Avatar className="h-3 w-3">
                  <AvatarFallback className="text-xs">
                    {assignedMember.display_name[0]}
                  </AvatarFallback>
                </Avatar>
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Family Calendar
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                className="rounded-r-none"
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
        
        <div className="text-lg font-semibold">
          {viewMode === 'week' 
            ? `Week of ${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
            : format(currentDate, 'MMMM yyyy')
          }
        </div>
      </CardHeader>

      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
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
                      className={cn(
                        "min-h-[120px] p-2 border rounded-md transition-colors",
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

                      {/* Empty State */}
                      {dayTasks.length === 0 && snapshot.isDraggingOver && (
                        <div className="text-center text-sm text-muted-foreground py-4 border-2 border-dashed border-green-300 rounded">
                          Drop task here
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          <div className="text-sm font-medium">Family Members:</div>
          {familyMembers.map((member, index) => (
            <Badge 
              key={member.id} 
              variant="outline" 
              className={cn("text-xs", memberColors[index % memberColors.length])}
            >
              {member.display_name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};