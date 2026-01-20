import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemberColor } from '@/hooks/useMemberColor';
import { EnhancedTaskItem } from '@/components/EnhancedTaskItem';
import { format, eachDayOfInterval, isSameDay, startOfDay, addDays, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import type { Task, Profile } from '@/types/task';

interface MemberConsistencyGridProps {
  member: {
    id: string;
    display_name: string;
    color: string;
    avatar_url?: string | null;
  };
  startDate: string;
  totalDays: number;
  completedDates: string[]; // Array of ISO date strings when task was completed
  onMarkComplete?: () => Promise<void>;
  isCompletingToday?: boolean;
  className?: string;
  // New props for showing task inline
  memberTask?: Task | null;
  allTasks?: Task[];
  familyMembers?: Profile[];
  onTaskToggle?: (task: Task) => void;
  isCompletingTask?: boolean;
}

export function MemberConsistencyGrid({
  member,
  startDate,
  totalDays,
  completedDates,
  onMarkComplete,
  isCompletingToday = false,
  className,
  memberTask,
  allTasks = [],
  familyMembers = [],
  onTaskToggle,
  isCompletingTask = false,
}: MemberConsistencyGridProps) {
  const { hex: memberHex } = useMemberColor(member.color);
  
  const start = startOfDay(parseISO(startDate));
  const end = addDays(start, totalDays - 1);
  const today = startOfDay(new Date());
  
  // Generate all days in the range
  const allDays = eachDayOfInterval({ start, end });
  
  // Create a set for faster lookup
  const completedSet = new Set(
    completedDates.map(d => format(startOfDay(parseISO(d)), 'yyyy-MM-dd'))
  );
  
  // Calculate stats
  const daysElapsed = Math.max(0, Math.min(totalDays, differenceInDays(today, start) + 1));
  const completedCount = completedDates.length;
  const todayKey = format(today, 'yyyy-MM-dd');
  const isTodayCompleted = completedSet.has(todayKey);
  const isTodayInRange = !isBefore(today, start) && !isAfter(today, end);
  
  // Calculate current streak
  let currentStreak = 0;
  let checkDate = today;
  while (!isBefore(checkDate, start)) {
    const dateKey = format(checkDate, 'yyyy-MM-dd');
    if (completedSet.has(dateKey)) {
      currentStreak++;
      checkDate = addDays(checkDate, -1);
    } else if (isSameDay(checkDate, today)) {
      // Today hasn't been completed yet, check yesterday
      checkDate = addDays(checkDate, -1);
    } else {
      break;
    }
  }
  
  // Generate inline styles for member color
  const completedBgStyle = { backgroundColor: memberHex };
  const missedBgStyle = { backgroundColor: `${memberHex}30` }; // 30 = ~19% opacity in hex
  
  return (
    <TooltipProvider>
      <div className={cn('p-4 rounded-lg border bg-card space-y-3', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar 
              name={member.display_name}
              color={member.color}
              avatarIcon={member.avatar_url || undefined}
              size="sm"
            />
            <div>
              <div className="font-medium text-sm">{member.display_name}</div>
              <div className="text-xs text-muted-foreground">
                {completedCount} / {daysElapsed} days completed
              </div>
            </div>
          </div>
          
          {currentStreak > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{currentStreak} day streak</span>
            </div>
          )}
        </div>
        
        {/* Grid */}
        <div className="flex flex-wrap gap-1">
          {allDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isCompleted = completedSet.has(dateKey);
            const isToday = isSameDay(day, today);
            const isFuture = isAfter(day, today);
            const isPast = !isFuture && !isToday;
            
            let style = {};
            let ringClass = '';
            
            if (isPast) {
              style = isCompleted ? completedBgStyle : missedBgStyle;
            } else if (isToday) {
              style = isCompleted ? completedBgStyle : missedBgStyle;
              ringClass = 'ring-2 ring-primary/50';
            } else {
              // Future - light grey
              style = { backgroundColor: 'hsl(var(--muted) / 0.3)' };
            }
            
            return (
              <Tooltip key={dateKey}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-sm cursor-default transition-colors',
                      ringClass
                    )}
                    style={style}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{format(day, 'EEE, MMM d')}</p>
                  <p className="text-muted-foreground">
                    {isFuture 
                      ? 'Upcoming' 
                      : isCompleted 
                        ? 'Completed ✓' 
                        : 'Missed'}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        
        {/* Footer with dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{format(start, 'MMM d')}</span>
          <span>{format(end, 'MMM d')}</span>
        </div>
        
        {/* Member's Task - rendered inline using EnhancedTaskItem */}
        {memberTask && onTaskToggle && (
          <div className="pt-2 border-t">
            <EnhancedTaskItem
              task={memberTask}
              allTasks={allTasks}
              familyMembers={familyMembers}
              onToggle={() => onTaskToggle(memberTask)}
              showActions={false}
              isCompleting={isCompletingTask}
            />
          </div>
        )}
        
        {/* Fallback: Mark Complete Button (only if no task is provided) */}
        {!memberTask && onMarkComplete && isTodayInRange && !isTodayCompleted && (
          <Button
            onClick={onMarkComplete}
            disabled={isCompletingToday}
            className="w-full"
            size="sm"
          >
            {isCompletingToday ? (
              'Completing...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Mark Today Complete
              </>
            )}
          </Button>
        )}
        
        {!memberTask && isTodayInRange && isTodayCompleted && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>Today completed!</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
