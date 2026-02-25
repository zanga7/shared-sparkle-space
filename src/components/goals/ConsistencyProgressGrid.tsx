import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X } from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, startOfDay, addDays, parseISO, isAfter, getDay } from 'date-fns';
import { useMemberColor } from '@/hooks/useMemberColor';
import { useMemo } from 'react';

interface ConsistencyProgressGridProps {
  startDate: string;
  totalDays: number;
  completedDates: string[]; // Array of ISO date strings when task was completed
  memberColor?: string; // Optional member color key for dynamic coloring
  className?: string;
  // Recurrence info from success_criteria
  frequency?: 'daily' | 'weekly';
  weekdays?: string[]; // e.g. ['monday','wednesday','friday']
}

// Map JS getDay() (0=Sun) to weekday keys
const JS_DAY_TO_KEY: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Returns only the dates within [start, end] that match the recurrence pattern.
 */
function getScheduledDays(
  start: Date,
  end: Date,
  frequency: 'daily' | 'weekly' | undefined,
  weekdays: string[] | undefined
): Date[] {
  const allDays = eachDayOfInterval({ start, end });

  // Daily frequency (or no frequency specified) = every calendar day
  if (!frequency || frequency === 'daily') {
    return allDays;
  }

  // Weekly with specific weekdays
  if (frequency === 'weekly' && weekdays && weekdays.length > 0) {
    const weekdaySet = new Set(weekdays);
    return allDays.filter(day => weekdaySet.has(JS_DAY_TO_KEY[getDay(day)]));
  }

  // Fallback: all days
  return allDays;
}

export function ConsistencyProgressGrid({
  startDate,
  totalDays,
  completedDates,
  memberColor,
  className,
  frequency,
  weekdays
}: ConsistencyProgressGridProps) {
  const start = startOfDay(parseISO(startDate));
  const end = addDays(start, totalDays - 1);
  const today = startOfDay(new Date());
  
  // Get the member's color for completed days
  const { hex: memberColorHex } = useMemberColor(memberColor);
  
  // Generate only scheduled days (not every calendar day)
  const scheduledDays = useMemo(
    () => getScheduledDays(start, end, frequency, weekdays),
    [start.getTime(), end.getTime(), frequency, weekdays?.join(',')]
  );
  
  // Create a set for faster lookup
  const completedSet = new Set(
    completedDates.map(d => format(startOfDay(parseISO(d)), 'yyyy-MM-dd'))
  );

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
        <div className="flex flex-wrap gap-1">
          {scheduledDays.map((day) => {
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

// Export the helper for reuse (e.g., in RPC replacement or other components)
export { getScheduledDays };
