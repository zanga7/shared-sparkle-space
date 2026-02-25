import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check } from 'lucide-react';
import { useMemberColor } from '@/hooks/useMemberColor';

interface TargetProgressGridProps {
  targetCount: number;
  completedCount: number;
  memberColor?: string;
  className?: string;
}

export function TargetProgressGrid({
  targetCount,
  completedCount,
  memberColor,
  className,
}: TargetProgressGridProps) {
  const { hex: memberColorHex } = useMemberColor(memberColor);
  const clamped = Math.min(completedCount, targetCount);

  // For large targets, show a condensed view
  const showCondensed = targetCount > 50;

  if (showCondensed) {
    // Show a progress bar style with count
    const percent = (clamped / targetCount) * 100;
    return (
      <div className={cn('space-y-1', className)}>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              backgroundColor: memberColorHex,
            }}
          />
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {clamped} / {targetCount}
        </div>
      </div>
    );
  }

  // Sequential slot grid
  const slots = Array.from({ length: targetCount }, (_, i) => i);

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
        <div className="flex flex-wrap gap-1">
          {slots.map((index) => {
            const isCompleted = index < clamped;
            const isNext = index === clamped;

            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-sm cursor-default transition-colors flex items-center justify-center',
                      !isCompleted && !isNext && 'bg-muted/30',
                      isNext && 'bg-muted/50 ring-1 ring-primary/50',
                    )}
                    style={isCompleted ? { backgroundColor: memberColorHex } : undefined}
                  >
                    {isCompleted && (
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>
                    #{index + 1} — {isCompleted ? 'Completed' : isNext ? 'Next' : 'Remaining'}
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
