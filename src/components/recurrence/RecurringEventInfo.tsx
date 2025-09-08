import { Badge } from '@/components/ui/badge';
import { Repeat, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { RecurrenceRule } from '@/types/recurrence';
import { format } from 'date-fns';

interface RecurringEventInfoProps {
  rule: RecurrenceRule;
  seriesStart?: string;
  seriesEnd?: string;
  className?: string;
}

export const RecurringEventInfo = ({ 
  rule, 
  seriesStart, 
  seriesEnd, 
  className = "" 
}: RecurringEventInfoProps) => {
  const getFrequencyText = () => {
    const interval = rule.interval || 1;
    const freq = rule.frequency;
    
    if (interval === 1) {
      return freq === 'daily' ? 'Daily' :
             freq === 'weekly' ? 'Weekly' :
             freq === 'monthly' ? 'Monthly' :
             freq === 'yearly' ? 'Yearly' : freq;
    } else {
      return freq === 'daily' ? `Every ${interval} days` :
             freq === 'weekly' ? `Every ${interval} weeks` :
             freq === 'monthly' ? `Every ${interval} months` :
             freq === 'yearly' ? `Every ${interval} years` : `Every ${interval} ${freq}`;
    }
  };

  const getEndText = () => {
    if (rule.endType === 'never') {
      return 'Forever';
    } else if (rule.endType === 'on_date' && rule.endDate) {
      return `Until ${format(new Date(rule.endDate), 'MMM dd, yyyy')}`;
    } else if (rule.endType === 'after_count' && rule.endCount) {
      return `For ${rule.endCount} occurrences`;
    }
    return 'Unknown';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <Repeat className="w-3 h-3 mr-1" />
          {getFrequencyText()}
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          {getEndText()}
        </Badge>
      </div>
      
      {seriesStart && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarIcon className="w-3 h-3" />
          Started {format(new Date(seriesStart), 'MMM dd, yyyy')}
          {seriesEnd && ` • Ends ${format(new Date(seriesEnd), 'MMM dd, yyyy')}`}
        </div>
      )}
    </div>
  );
};