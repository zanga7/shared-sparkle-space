import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Infinity, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RecurrenceEndType } from '@/types/recurrence';

interface RecurrenceEndsProps {
  endType: RecurrenceEndType;
  endDate?: Date;
  endCount?: number;
  onEndTypeChange: (type: RecurrenceEndType) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onEndCountChange: (count: number) => void;
}

export const RecurrenceEnds = ({
  endType,
  endDate,
  endCount = 10,
  onEndTypeChange,
  onEndDateChange,
  onEndCountChange
}: RecurrenceEndsProps) => {
  
  const endOptions = [
    {
      type: 'never' as RecurrenceEndType,
      label: 'Never',
      description: 'Continues indefinitely',
      icon: Infinity
    },
    {
      type: 'on_date' as RecurrenceEndType,
      label: 'On date',
      description: 'Ends on a specific date',
      icon: CalendarIcon
    },
    {
      type: 'after_count' as RecurrenceEndType,
      label: 'After',
      description: 'Ends after a number of times',
      icon: Hash
    }
  ];

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">When should this stop?</Label>
      
      {/* End type selection */}
      <div className="grid grid-cols-3 gap-2">
        {endOptions.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant={endType === type ? "default" : "outline"}
            className="h-auto p-3 flex-col gap-2"
            onClick={() => onEndTypeChange(type)}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </Button>
        ))}
      </div>

      {/* End date picker */}
      {endType === 'on_date' && (
        <div className="space-y-2">
          <Label className="text-sm">End date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "Pick end date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={onEndDateChange}
                disabled={(date) => date < new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* End count input */}
      {endType === 'after_count' && (
        <div className="space-y-2">
          <Label className="text-sm">Number of times</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">After</span>
            <Input
              type="number"
              min="1"
              max="999"
              value={endCount}
              onChange={(e) => onEndCountChange(parseInt(e.target.value) || 1)}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">times</span>
          </div>
        </div>
      )}
    </div>
  );
};