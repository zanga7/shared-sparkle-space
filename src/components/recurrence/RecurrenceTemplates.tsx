import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Sun, Clock, CalendarDays, Briefcase } from 'lucide-react';
import { RecurrenceRule } from '@/types/recurrence';

interface RecurrenceTemplate {
  id: string;
  label: string;
  description: string;
  icon: typeof Calendar;
  rule: Partial<RecurrenceRule>;
}

const TEMPLATES: RecurrenceTemplate[] = [
  {
    id: 'weekdays',
    label: 'Every Weekday',
    description: 'Monday through Friday',
    icon: Briefcase,
    rule: {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      endType: 'never'
    }
  },
  {
    id: 'weekend',
    label: 'Every Weekend',
    description: 'Saturday and Sunday',
    icon: Sun,
    rule: {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['saturday', 'sunday'],
      endType: 'never'
    }
  },
  {
    id: 'daily',
    label: 'Every Day',
    description: 'All 7 days of the week',
    icon: CalendarDays,
    rule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never'
    }
  },
  {
    id: 'weekly',
    label: 'Every Week',
    description: 'Same day each week',
    icon: Clock,
    rule: {
      frequency: 'weekly',
      interval: 1,
      endType: 'never'
    }
  },
  {
    id: 'monthly',
    label: 'Every Month',
    description: 'Same day each month',
    icon: Calendar,
    rule: {
      frequency: 'monthly',
      interval: 1,
      monthlyType: 'on_day',
      endType: 'never'
    }
  },
];

interface RecurrenceTemplatesProps {
  onSelectTemplate: (rule: Partial<RecurrenceRule>) => void;
}

export function RecurrenceTemplates({ onSelectTemplate }: RecurrenceTemplatesProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Quick Presets</h4>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map(template => {
          const Icon = template.icon;
          return (
            <Card 
              key={template.id}
              className="p-3 cursor-pointer hover:border-primary transition-colors hover:bg-accent/50"
              onClick={() => onSelectTemplate(template.rule)}
            >
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <h4 className="font-medium text-sm leading-tight">{template.label}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}