import { PublicHoliday } from '@/types/celebration';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PublicHolidayBadgeProps {
  holiday: PublicHoliday;
}

export const PublicHolidayBadge = ({ holiday }: PublicHolidayBadgeProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default py-0.5">
            <span>{holiday.flag_emoji}</span>
            <span className="truncate">{holiday.holiday_name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{holiday.holiday_name}</p>
            <p className="text-xs text-muted-foreground">
              {holiday.region_code}
              {holiday.holiday_type && ` • ${holiday.holiday_type}`}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
