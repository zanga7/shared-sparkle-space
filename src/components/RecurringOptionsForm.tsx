import React from 'react';
import { Calendar, CalendarDays, Clock, Hash, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface RecurringOptionsFormProps {
  formData: {
    recurring_frequency: string;
    recurring_interval: number;
    recurring_days_of_week: number[];
    recurring_end_date: string;
    start_date?: string;
    repetition_count?: number;
    monthly_type?: 'date' | 'weekday';
    monthly_weekday_ordinal?: number;
  };
  onChange: (field: string, value: any) => void;
  selectedDate?: Date;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const ORDINAL_OPTIONS = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: -1, label: 'Last' },
];

export const RecurringOptionsForm: React.FC<RecurringOptionsFormProps> = ({
  formData,
  onChange,
  selectedDate,
}) => {
  const handleDayToggle = (day: number) => {
    const currentDays = formData.recurring_days_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    onChange('recurring_days_of_week', newDays);
  };

  const getStartDate = () => {
    if (formData.start_date) {
      return new Date(formData.start_date);
    }
    return selectedDate || new Date();
  };

  const handleStartDateChange = (date: Date | undefined) => {
    onChange('start_date', date?.toISOString());
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onChange('recurring_end_date', date?.toISOString() || '');
  };

  const getRecurringSummary = () => {
    const { recurring_frequency, recurring_interval, recurring_days_of_week, monthly_type, monthly_weekday_ordinal } = formData;
    
    let summary = 'Repeats ';
    
    if (recurring_frequency === 'daily') {
      summary += recurring_interval === 1 ? 'daily' : `every ${recurring_interval} days`;
    } else if (recurring_frequency === 'weekly') {
      const days = recurring_days_of_week || [];
      if (days.length === 0) {
        summary += recurring_interval === 1 ? 'weekly' : `every ${recurring_interval} weeks`;
      } else {
        const dayNames = days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ');
        summary += `weekly on ${dayNames}`;
        if (recurring_interval > 1) {
          summary += ` (every ${recurring_interval} weeks)`;
        }
      }
    } else if (recurring_frequency === 'monthly') {
      if (monthly_type === 'weekday' && monthly_weekday_ordinal) {
        const ordinal = ORDINAL_OPTIONS.find(o => o.value === monthly_weekday_ordinal)?.label;
        const startDate = getStartDate();
        const dayName = format(startDate, 'EEEE');
        summary += `monthly on the ${ordinal} ${dayName}`;
      } else {
        const startDate = getStartDate();
        summary += `monthly on the ${format(startDate, 'do')}`;
      }
      if (recurring_interval > 1) {
        summary += ` (every ${recurring_interval} months)`;
      }
    } else if (recurring_frequency === 'yearly') {
      const startDate = getStartDate();
      summary += `yearly on ${format(startDate, 'MMMM do')}`;
    }

    return summary;
  };

  return (
    <div className="space-y-4">
      {/* Frequency Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Frequency
        </Label>
        <Select
          value={formData.recurring_frequency}
          onValueChange={(value) => onChange('recurring_frequency', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interval */}
      {(formData.recurring_frequency === 'daily' || formData.recurring_frequency === 'weekly' || formData.recurring_frequency === 'monthly') && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Interval
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="365"
              value={formData.recurring_interval}
              onChange={(e) => onChange('recurring_interval', parseInt(e.target.value) || 1)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {formData.recurring_frequency === 'daily' && `day${formData.recurring_interval !== 1 ? 's' : ''}`}
              {formData.recurring_frequency === 'weekly' && `week${formData.recurring_interval !== 1 ? 's' : ''}`}
              {formData.recurring_frequency === 'monthly' && `month${formData.recurring_interval !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      )}

      {/* Days of Week (Weekly) */}
      {formData.recurring_frequency === 'weekly' && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Days of Week
          </Label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.value}
                type="button"
                variant={formData.recurring_days_of_week?.includes(day.value) ? "default" : "outline"}
                size="sm"
                onClick={() => handleDayToggle(day.value)}
                className="h-8 w-12"
              >
                {day.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Options */}
      {formData.recurring_frequency === 'monthly' && (
        <div className="space-y-3">
          <Label>Monthly Recurrence</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="monthly-date"
                checked={formData.monthly_type !== 'weekday'}
                onCheckedChange={(checked) => onChange('monthly_type', checked ? 'date' : 'weekday')}
              />
              <Label htmlFor="monthly-date" className="text-sm">
                On the same date each month
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="monthly-weekday"
                checked={formData.monthly_type === 'weekday'}
                onCheckedChange={(checked) => onChange('monthly_type', checked ? 'weekday' : 'date')}
              />
              <Label htmlFor="monthly-weekday" className="text-sm">
                On a specific weekday
              </Label>
            </div>

            {formData.monthly_type === 'weekday' && (
              <div className="ml-6 flex items-center gap-2">
                <Select
                  value={formData.monthly_weekday_ordinal?.toString()}
                  onValueChange={(value) => onChange('monthly_weekday_ordinal', parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDINAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {format(getStartDate(), 'EEEE')} of each month
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Date */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Start Date
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !getStartDate() && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {getStartDate() ? format(getStartDate(), "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarComponent
              mode="single"
              selected={getStartDate()}
              onSelect={handleStartDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* End Condition */}
      <div className="space-y-2">
        <Label>End Condition</Label>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="never-end"
              checked={!formData.recurring_end_date && !formData.repetition_count}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange('recurring_end_date', '');
                  onChange('repetition_count', null);
                }
              }}
            />
            <Label htmlFor="never-end" className="text-sm">
              Never (continues indefinitely)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="end-date"
              checked={!!formData.recurring_end_date}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange('repetition_count', null);
                } else {
                  onChange('recurring_end_date', '');
                }
              }}
            />
            <Label htmlFor="end-date" className="text-sm">
              End on specific date
            </Label>
          </div>

          {formData.recurring_end_date && (
            <div className="ml-6">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.recurring_end_date ? format(new Date(formData.recurring_end_date), "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={formData.recurring_end_date ? new Date(formData.recurring_end_date) : undefined}
                    onSelect={handleEndDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="repetition-count"
              checked={!!formData.repetition_count}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange('recurring_end_date', '');
                  onChange('repetition_count', 10);
                } else {
                  onChange('repetition_count', null);
                }
              }}
            />
            <Label htmlFor="repetition-count" className="text-sm">
              After number of occurrences
            </Label>
          </div>

          {formData.repetition_count && (
            <div className="ml-6 flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="1000"
                value={formData.repetition_count}
                onChange={(e) => onChange('repetition_count', parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">occurrences</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {formData.recurring_frequency && (
        <div className="pt-2 border-t">
          <Badge variant="secondary" className="text-xs">
            {getRecurringSummary()}
          </Badge>
        </div>
      )}
    </div>
  );
};