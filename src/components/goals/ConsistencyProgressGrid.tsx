import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X } from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, startOfDay, addDays, parseISO, isAfter } from 'date-fns';
import { useMemberColor } from '@/hooks/useMemberColor';

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
  
  // Get the member's color for completed days
  const { hex: memberColorHex } = useMemberColor(memberColor);
  
  // Generate all days in the range
  const allDays = eachDayOfInterval({ start, end });
  
  // Create a set for faster lookup
  const completedSet = new Set(
    completedDates.map(d => format(startOfDay(parseISO(d)), 'yyyy-MM-dd'))
  );

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
        <div className="flex flex-wrap gap-1">
          {allDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isCompleted = completedSet.has(dateKey);
            const isToday = isSameDay(day, today);
            const isFuture = isAfter(day, today);
            const isPast = !isFuture && !isToday;
            const isMissed = isPast && !isCompleted;
            
            return (
              <Tooltip key={dateKey}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-sm cursor-default transition-colors flex items-center justify-center',
                      isMissed && 'bg-orange-500/20',
                      isToday && !isCompleted && 'bg-muted/50 ring-1 ring-primary/50',
                      isFuture && 'bg-muted/30'
                    )}
                    style={isCompleted ? { backgroundColor: memberColorHex } : undefined}
                  >
                    {isMissed && (
                      <X className="h-2.5 w-2.5 text-orange-500" strokeWidth={2.5} />
                    )}
                  </div>
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
      </div>
    </TooltipProvider>
  );
}
