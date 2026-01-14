import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, eachDayOfInterval, isSameDay, startOfDay, addDays, parseISO, isAfter } from 'date-fns';

interface CompletionDate {
  date: string;
  completed: boolean;
}

interface ConsistencyProgressGridProps {
  startDate: string;
  totalDays: number;
  completedDates: string[]; // Array of ISO date strings when task was completed
  memberColor?: string; // Optional member color key for dynamic coloring
  className?: string;
}

export function ConsistencyProgressGrid({
  startDate,
  totalDays,
  completedDates,
  memberColor,
  className
}: ConsistencyProgressGridProps) {
  const start = startOfDay(parseISO(startDate));
  const end = addDays(start, totalDays - 1);
  const today = startOfDay(new Date());
  
  // Generate all days in the range
  const allDays = eachDayOfInterval({ start, end });
  
  // Create a set for faster lookup
  const completedSet = new Set(
    completedDates.map(d => format(startOfDay(parseISO(d)), 'yyyy-MM-dd'))
  );

  return (
    <TooltipProvider>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted/50 ring-1 ring-primary/30" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted/30" />
            <span>Upcoming</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {allDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isCompleted = completedSet.has(dateKey);
            const isToday = isSameDay(day, today);
            const isFuture = isAfter(day, today);
            const isPast = !isFuture && !isToday;
            
            let bgClass = 'bg-muted/30'; // Future - light grey
            if (isPast) {
              bgClass = isCompleted ? 'bg-green-500' : 'bg-muted'; // Past: green if completed, grey if missed
            } else if (isToday) {
              bgClass = isCompleted ? 'bg-green-500' : 'bg-muted/50 ring-1 ring-primary/50';
            }
            
            return (
              <Tooltip key={dateKey}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-sm cursor-default transition-colors',
                      bgClass
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{format(day, 'EEE, MMM d')}</p>
                  <p className="text-muted-foreground">
                    {isFuture 
                      ? 'Upcoming' 
                      : isCompleted 
                        ? 'Completed' 
                        : 'Missed'}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(start, 'MMM d')}</span>
          <span>{completedDates.length} / {Math.min(totalDays, allDays.filter(d => !isAfter(d, today)).length)} completed</span>
          <span>{format(end, 'MMM d')}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
