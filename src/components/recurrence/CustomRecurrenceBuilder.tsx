import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecurrenceFrequency, RecurrenceRule, WeekdayKey, MonthlyType, OrdinalPosition } from '@/types/recurrence';

interface CustomRecurrenceBuilderProps {
  rule: RecurrenceRule;
  onRuleChange: (rule: RecurrenceRule) => void;
}

export const CustomRecurrenceBuilder = ({ rule, onRuleChange }: CustomRecurrenceBuilderProps) => {
  
  const updateRule = (updates: Partial<RecurrenceRule>) => {
    onRuleChange({ ...rule, ...updates });
  };

  const weekdays: Array<{ key: WeekdayKey; label: string; short: string }> = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' }
  ];

  const ordinalPositions: Array<{ key: OrdinalPosition; label: string }> = [
    { key: 'first', label: '1st' },
    { key: 'second', label: '2nd' },
    { key: 'third', label: '3rd' },
    { key: 'fourth', label: '4th' },
    { key: 'last', label: 'Last' }
  ];

  const toggleWeekday = (weekday: WeekdayKey) => {
    const currentWeekdays = rule.weekdays || [];
    const newWeekdays = currentWeekdays.includes(weekday)
      ? currentWeekdays.filter(w => w !== weekday)
      : [...currentWeekdays, weekday];
    updateRule({ weekdays: newWeekdays });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Custom Rule Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Frequency and Interval */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select 
              value={rule.frequency} 
              onValueChange={(value: RecurrenceFrequency) => updateRule({ frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Every</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="99"
                value={rule.interval}
                onChange={(e) => updateRule({ interval: parseInt(e.target.value) || 1 })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">
                {rule.frequency === 'daily' && (rule.interval === 1 ? 'day' : 'days')}
                {rule.frequency === 'weekly' && (rule.interval === 1 ? 'week' : 'weeks')}
                {rule.frequency === 'monthly' && (rule.interval === 1 ? 'month' : 'months')}
                {rule.frequency === 'yearly' && (rule.interval === 1 ? 'year' : 'years')}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly - Day selection */}
        {rule.frequency === 'weekly' && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label>Days of the week</Label>
              <div className="grid grid-cols-7 gap-1">
                {weekdays.map(({ key, short }) => (
                  <Button
                    key={key}
                    variant={(rule.weekdays || []).includes(key) ? "default" : "outline"}
                    size="sm"
                    className="h-10 text-xs"
                    onClick={() => toggleWeekday(key)}
                  >
                    {short}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Monthly - Type selection */}
        {rule.frequency === 'monthly' && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label>Monthly repeat type</Label>
              
              <div className="space-y-3">
                {/* On specific day */}
                <div className="flex items-center gap-3">
                  <Button
                    variant={rule.monthlyType === 'on_day' ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateRule({ monthlyType: 'on_day' })}
                  >
                    On day
                  </Button>
                  {rule.monthlyType === 'on_day' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={rule.monthDay || 1}
                        onChange={(e) => updateRule({ monthDay: parseInt(e.target.value) || 1 })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className="w-16 text-center"
                      />
                      <span className="text-sm text-muted-foreground">of the month</span>
                    </div>
                  )}
                </div>

                {/* On specific weekday */}
                <div className="flex items-center gap-3">
                  <Button
                    variant={rule.monthlyType === 'on_weekday' ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateRule({ monthlyType: 'on_weekday' })}
                  >
                    On the
                  </Button>
                  {rule.monthlyType === 'on_weekday' && (
                    <div className="flex items-center gap-2">
                      <Select 
                        value={rule.weekdayOrdinal} 
                        onValueChange={(value: OrdinalPosition) => updateRule({ weekdayOrdinal: value })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ordinalPositions.map(({ key, label }) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={rule.weekdayName} 
                        onValueChange={(value: WeekdayKey) => updateRule({ weekdayName: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdays.map(({ key, label }) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};