import { Button } from '@/components/ui/button';
import { Calendar, GraduationCap, Sun, RotateCcw, CalendarDays, Timer, Settings } from 'lucide-react';
import { RecurrencePreset, RecurrencePresetConfig } from '@/types/recurrence';

interface RecurrencePresetsProps {
  selectedPreset: RecurrencePreset;
  onPresetChange: (preset: RecurrencePreset) => void;
  selectedDate?: Date;
}

export const RecurrencePresets = ({ 
  selectedPreset, 
  onPresetChange, 
  selectedDate 
}: RecurrencePresetsProps) => {
  
  const getWeekdayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getMonthDay = (date: Date) => {
    return date.getDate();
  };

  const presets: Array<{ preset: RecurrencePreset; config: RecurrencePresetConfig }> = [
    {
      preset: 'every_day',
      config: {
        label: 'Every day',
        description: 'Repeats daily',
        rule: { frequency: 'daily', interval: 1 },
        icon: 'Calendar'
      }
    },
    {
      preset: 'school_days',
      config: {
        label: 'School days',
        description: 'Monday to Friday',
        rule: { 
          frequency: 'weekly', 
          interval: 1, 
          weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] 
        },
        icon: 'GraduationCap'
      }
    },
    {
      preset: 'weekends',
      config: {
        label: 'Weekends',
        description: 'Saturday and Sunday',
        rule: { 
          frequency: 'weekly', 
          interval: 1, 
          weekdays: ['saturday', 'sunday'] 
        },
        icon: 'Sun'
      }
    },
    {
      preset: 'every_week',
      config: {
        label: selectedDate ? `Every ${getWeekdayName(selectedDate)}` : 'Every week',
        description: selectedDate ? `Weekly on ${getWeekdayName(selectedDate)}` : 'Same day each week',
        rule: { 
          frequency: 'weekly', 
          interval: 1,
          weekdays: selectedDate ? [getWeekdayName(selectedDate).toLowerCase() as any] : ['monday']
        },
        icon: 'RotateCcw'
      }
    },
    {
      preset: 'every_month',
      config: {
        label: selectedDate ? `Every month on the ${getMonthDay(selectedDate)}` : 'Every month',
        description: selectedDate ? `Monthly on day ${getMonthDay(selectedDate)}` : 'Same date each month',
        rule: { 
          frequency: 'monthly', 
          interval: 1,
          monthlyType: 'on_day',
          monthDay: selectedDate ? getMonthDay(selectedDate) : 1
        },
        icon: 'CalendarDays'
      }
    },
    {
      preset: 'every_year',
      config: {
        label: selectedDate ? `Every year on ${selectedDate.toLocaleDateString()}` : 'Every year',
        description: 'Annual repeat',
        rule: { frequency: 'yearly', interval: 1 },
        icon: 'Timer'
      }
    },
    {
      preset: 'custom',
      config: {
        label: 'Custom',
        description: 'Build your own rule',
        rule: {},
        icon: 'Settings'
      }
    }
  ];

  const getIcon = (iconName: string) => {
    const icons = {
      Calendar,
      GraduationCap,
      Sun,
      RotateCcw,
      CalendarDays,
      Timer,
      Settings
    };
    const IconComponent = icons[iconName as keyof typeof icons] || Calendar;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">How often?</label>
      <div className="grid grid-cols-2 gap-3">
        {presets.map(({ preset, config }) => (
          <Button
            key={preset}
            variant={selectedPreset === preset ? "default" : "outline"}
            className={`h-auto p-4 justify-start text-left ${
              selectedPreset === preset ? "" : "hover:bg-muted/50"
            }`}
            onClick={() => onPresetChange(preset)}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="mt-0.5 flex-shrink-0">
                {getIcon(config.icon || 'Calendar')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight">
                  {config.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight">
                  {config.description}
                </div>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};