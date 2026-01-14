import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Repeat } from 'lucide-react';
import type { RecurrenceRule, WeekdayKey } from '@/types/recurrence';

interface SimpleFrequencySelectorProps {
  rule: RecurrenceRule;
  onRuleChange: (rule: RecurrenceRule) => void;
}

const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'M' },
  { key: 'tuesday', label: 'Tuesday', short: 'T' },
  { key: 'wednesday', label: 'Wednesday', short: 'W' },
  { key: 'thursday', label: 'Thursday', short: 'T' },
  { key: 'friday', label: 'Friday', short: 'F' },
  { key: 'saturday', label: 'Saturday', short: 'S' },
  { key: 'sunday', label: 'Sunday', short: 'S' },
];

export function SimpleFrequencySelector({ rule, onRuleChange }: SimpleFrequencySelectorProps) {
  const isDaily = rule.frequency === 'daily' && rule.interval === 1;
  const isWeekdays = rule.frequency === 'weekly' && 
    rule.weekdays?.length === 5 &&
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every(d => rule.weekdays?.includes(d as WeekdayKey));
  const isCustomDays = rule.frequency === 'weekly' && !isWeekdays;

  const handleFrequencyTypeChange = (type: 'daily' | 'weekdays' | 'custom') => {
    if (type === 'daily') {
      onRuleChange({
        ...rule,
        frequency: 'daily',
        interval: 1,
        weekdays: undefined
      });
    } else if (type === 'weekdays') {
      onRuleChange({
        ...rule,
        frequency: 'weekly',
        interval: 1,
        weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    } else {
      // Custom - default to all days selected
      onRuleChange({
        ...rule,
        frequency: 'weekly',
        interval: 1,
        weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      });
    }
  };

  const toggleWeekday = (day: WeekdayKey) => {
    const currentDays = rule.weekdays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    // Must have at least one day selected
    if (newDays.length === 0) return;
    
    onRuleChange({
      ...rule,
      frequency: 'weekly',
      weekdays: newDays
    });
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Repeat className="h-4 w-4" />
        How often?
      </Label>
      
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleFrequencyTypeChange('daily')}
          className={cn(
            "p-3 rounded-lg border text-center transition-all",
            isDaily 
              ? "border-primary bg-primary/10 ring-1 ring-primary/20" 
              : "hover:border-primary/50"
          )}
        >
          <div className="font-medium text-sm">Every day</div>
          <div className="text-xs text-muted-foreground">7 days/week</div>
        </button>
        
        <button
          type="button"
          onClick={() => handleFrequencyTypeChange('weekdays')}
          className={cn(
            "p-3 rounded-lg border text-center transition-all",
            isWeekdays 
              ? "border-primary bg-primary/10 ring-1 ring-primary/20" 
              : "hover:border-primary/50"
          )}
        >
          <div className="font-medium text-sm">Weekdays</div>
          <div className="text-xs text-muted-foreground">Mon-Fri</div>
        </button>
        
        <button
          type="button"
          onClick={() => handleFrequencyTypeChange('custom')}
          className={cn(
            "p-3 rounded-lg border text-center transition-all",
            isCustomDays 
              ? "border-primary bg-primary/10 ring-1 ring-primary/20" 
              : "hover:border-primary/50"
          )}
        >
          <div className="font-medium text-sm">Specific days</div>
          <div className="text-xs text-muted-foreground">Choose days</div>
        </button>
      </div>
      
      {/* Custom day selector */}
      {isCustomDays && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <Label className="text-xs text-muted-foreground">Select days</Label>
          <div className="flex gap-1 justify-center">
            {WEEKDAYS.map((day, index) => {
              const isSelected = rule.weekdays?.includes(day.key);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleWeekday(day.key)}
                  className={cn(
                    "w-9 h-9 rounded-full text-sm font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border hover:border-primary/50"
                  )}
                  title={day.label}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {rule.weekdays?.length || 0} day{(rule.weekdays?.length || 0) !== 1 ? 's' : ''} per week
          </p>
        </div>
      )}
    </div>
  );
}
