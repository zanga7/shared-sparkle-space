import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { validateRRULE } from '@/utils/rruleConverter';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CalendarCompatibilityIndicatorProps {
  rrule?: string;
  recurrenceEnabled?: boolean;
}

export const CalendarCompatibilityIndicator = ({ 
  rrule, 
  recurrenceEnabled = false 
}: CalendarCompatibilityIndicatorProps) => {
  
  if (!recurrenceEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5">
              <CheckCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">One-time event</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">This event does not repeat</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!rrule) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1.5 border-amber-500/50 text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-xs">Generating...</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Calendar format is being generated</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const validation = validateRRULE(rrule);

  if (!validation.valid) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1.5">
              <XCircle className="h-3 w-3" />
              <span className="text-xs">Invalid format</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">{validation.error || 'Invalid RRULE format'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1.5 border-green-500/50 text-green-700">
            <CheckCircle className="h-3 w-3" />
            <span className="text-xs">Calendar compatible</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            This event can sync with Google Calendar, iCal, and other RFC 5545 compatible calendars
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
