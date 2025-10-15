import { RRule, Frequency, Weekday } from 'rrule';
import { RecurrenceRule, WeekdayKey, OrdinalPosition } from '@/types/recurrence';

/**
 * Converts custom RecurrenceRule JSON format to RFC 5545 RRULE string
 * This enables integration with Google Calendar, Outlook, and .ics exports
 */
export function toRRULE(rule: RecurrenceRule, dtstart: Date): string {
  try {
    const options: any = {
      freq: getFrequency(rule.frequency),
      interval: rule.interval || 1,
      dtstart: dtstart,
    };

    // Handle weekly recurrence with specific weekdays
    if (rule.frequency === 'weekly' && rule.weekdays?.length) {
      options.byweekday = rule.weekdays.map(weekdayToRRuleDay);
    }

    // Handle monthly recurrence
    if (rule.frequency === 'monthly') {
      if (rule.monthlyType === 'on_day' && rule.monthDay) {
        options.bymonthday = rule.monthDay;
      } else if (rule.monthlyType === 'on_weekday' && rule.weekdayOrdinal && rule.weekdayName) {
        const weekday = weekdayToRRuleDay(rule.weekdayName);
        const ordinal = ordinalToNumber(rule.weekdayOrdinal);
        options.byweekday = weekday.nth(ordinal);
      }
    }

    // Handle end conditions
    if (rule.endType === 'on_date' && rule.endDate) {
      options.until = new Date(rule.endDate);
    } else if (rule.endType === 'after_count' && rule.endCount) {
      options.count = rule.endCount;
    }
    // If endType is 'never', no additional options needed

    const rrule = new RRule(options);
    return rrule.toString();
  } catch (error) {
    console.error('Error converting to RRULE:', error);
    throw new Error(`Failed to convert RecurrenceRule to RRULE: ${error}`);
  }
}

/**
 * Converts RFC 5545 RRULE string back to custom RecurrenceRule JSON format
 */
export function fromRRULE(rruleString: string): Partial<RecurrenceRule> {
  try {
    const rrule = RRule.fromString(rruleString);
    const options = rrule.origOptions;

    const rule: Partial<RecurrenceRule> = {
      frequency: getFrequencyName(options.freq),
      interval: options.interval || 1,
    };

    // Handle weekly weekdays
    if (options.byweekday && Array.isArray(options.byweekday)) {
      rule.weekdays = options.byweekday.map(rruleDayToWeekday);
    }

    // Handle monthly patterns
    if (options.bymonthday) {
      rule.monthlyType = 'on_day';
      rule.monthDay = Array.isArray(options.bymonthday) ? options.bymonthday[0] : options.bymonthday;
    } else if (options.byweekday && !Array.isArray(options.byweekday)) {
      rule.monthlyType = 'on_weekday';
      const wd = options.byweekday as any;
      if (wd.n !== undefined) {
        rule.weekdayOrdinal = numberToOrdinal(wd.n);
        rule.weekdayName = rruleDayToWeekday(wd.weekday);
      }
    }

    // Handle end conditions
    if (options.until) {
      rule.endType = 'on_date';
      rule.endDate = options.until.toISOString();
    } else if (options.count) {
      rule.endType = 'after_count';
      rule.endCount = options.count;
    } else {
      rule.endType = 'never';
    }

    return rule;
  } catch (error) {
    console.error('Error parsing RRULE:', error);
    throw new Error(`Failed to parse RRULE string: ${error}`);
  }
}

/**
 * Validates an RRULE string for RFC 5545 compliance
 */
export function validateRRULE(rruleString: string): { valid: boolean; error?: string } {
  try {
    RRule.fromString(rruleString);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid RRULE format',
    };
  }
}

/**
 * Generates a human-readable summary from an RRULE string
 */
export function getRRULESummary(rruleString: string): string {
  try {
    const rrule = RRule.fromString(rruleString);
    return rrule.toText();
  } catch (error) {
    return 'Invalid recurrence rule';
  }
}

// Helper functions for conversion between custom types and rrule.js types

function getFrequency(freq: string): Frequency {
  const frequencyMap: Record<string, Frequency> = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };
  return frequencyMap[freq] || RRule.DAILY;
}

function getFrequencyName(freq: Frequency): 'daily' | 'weekly' | 'monthly' | 'yearly' {
  const freqMap: Record<number, 'daily' | 'weekly' | 'monthly' | 'yearly'> = {
    [RRule.DAILY]: 'daily',
    [RRule.WEEKLY]: 'weekly',
    [RRule.MONTHLY]: 'monthly',
    [RRule.YEARLY]: 'yearly',
  };
  return freqMap[freq] || 'daily';
}

function weekdayToRRuleDay(weekday: WeekdayKey): Weekday {
  const dayMap: Record<WeekdayKey, Weekday> = {
    monday: RRule.MO,
    tuesday: RRule.TU,
    wednesday: RRule.WE,
    thursday: RRule.TH,
    friday: RRule.FR,
    saturday: RRule.SA,
    sunday: RRule.SU,
  };
  return dayMap[weekday];
}

function rruleDayToWeekday(day: Weekday | number): WeekdayKey {
  const weekdayNum = typeof day === 'number' ? day : day.weekday;
  const dayMap: Record<number, WeekdayKey> = {
    0: 'monday',
    1: 'tuesday',
    2: 'wednesday',
    3: 'thursday',
    4: 'friday',
    5: 'saturday',
    6: 'sunday',
  };
  return dayMap[weekdayNum] || 'monday';
}

function ordinalToNumber(ordinal: OrdinalPosition): number {
  const ordinalMap: Record<OrdinalPosition, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    last: -1,
  };
  return ordinalMap[ordinal];
}

function numberToOrdinal(num: number): OrdinalPosition {
  const numMap: Record<number, OrdinalPosition> = {
    1: 'first',
    2: 'second',
    3: 'third',
    4: 'fourth',
    '-1': 'last',
  };
  return numMap[num] || 'first';
}
