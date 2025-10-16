import { RRule, RRuleSet, rrulestr } from 'rrule';
import { toRRULE } from './rruleConverter';
import { RecurrenceRule } from '@/types/recurrence';
import { RecurrenceException } from '@/types/series';
import { format } from 'date-fns';

/**
 * Generates instances of a recurring series using rrule.js
 * This provides accurate, RFC 5545 compliant instance generation
 */
export interface InstanceGenerationOptions {
  startDate: Date;
  endDate: Date;
  seriesStart: Date; // NEW: The true start of the series for DTSTART
  recurrenceRule: RecurrenceRule;
  exceptions?: RecurrenceException[];
  maxInstances?: number;
}

export interface GeneratedInstance {
  date: Date;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
  overrideData?: any;
}

/**
 * Generate instances for a date range using rrule.js
 */
export function generateInstances(options: InstanceGenerationOptions): GeneratedInstance[] {
  const {
    startDate,
    endDate,
    seriesStart,
    recurrenceRule,
    exceptions = [],
    maxInstances = 1000,
  } = options;

  try {
    // Create RRULE string from recurrence rule using the series' true start
    const rruleString = toRRULE(recurrenceRule, seriesStart);
    
    // Create RRuleSet to handle exceptions
    const rruleSet = new RRuleSet();
    
    // Add the main recurrence rule with seriesStart as DTSTART
    const mainRule = rrulestr(rruleString, { dtstart: seriesStart });
    rruleSet.rrule(mainRule);

    // Add exception dates (EXDATE) for skipped instances
    const skipExceptions = exceptions.filter(ex => ex.exception_type === 'skip');
    skipExceptions.forEach(ex => {
      const exDate = new Date(ex.exception_date);
      rruleSet.exdate(exDate);
    });

    // Generate all instances within the date range
    const instances = rruleSet.between(
      startDate,
      endDate,
      true // inclusive
    );

    // Limit to max instances for performance
    const limitedInstances = instances.slice(0, maxInstances);

    // Map to GeneratedInstance format and apply overrides
    const result: GeneratedInstance[] = limitedInstances.map(date => {
      // Use timezone-safe date formatting for local-day matching
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Check if this date has an override exception
      const overrideException = exceptions.find(
        ex => ex.exception_type === 'override' && 
              ex.exception_date === dateStr
      );

      if (overrideException) {
        return {
          date,
          isException: true,
          exceptionType: 'override',
          overrideData: overrideException.override_data,
        };
      }

      return {
        date,
        isException: false,
      };
    });

    return result;
  } catch (error) {
    console.error('Error generating instances:', error);
    return [];
  }
}

/**
 * Get the next occurrence after a given date
 */
export function getNextOccurrence(
  afterDate: Date,
  recurrenceRule: RecurrenceRule,
  seriesStart: Date
): Date | null {
  try {
    const rruleString = toRRULE(recurrenceRule, seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: seriesStart });
    
    const next = rrule.after(afterDate, true);
    return next;
  } catch (error) {
    console.error('Error getting next occurrence:', error);
    return null;
  }
}

/**
 * Get all occurrences up to a maximum count
 */
export function getOccurrences(
  recurrenceRule: RecurrenceRule,
  seriesStart: Date,
  count: number
): Date[] {
  try {
    const rruleString = toRRULE(recurrenceRule, seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: seriesStart });
    
    return rrule.all((_, i) => i < count);
  } catch (error) {
    console.error('Error getting occurrences:', error);
    return [];
  }
}

/**
 * Check if a specific date is an occurrence
 */
export function isOccurrence(
  date: Date,
  recurrenceRule: RecurrenceRule,
  seriesStart: Date
): boolean {
  try {
    const rruleString = toRRULE(recurrenceRule, seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: seriesStart });
    
    // Check if the date matches any occurrence
    const occurrences = rrule.between(
      new Date(date.getTime() - 1000), // 1 second before
      new Date(date.getTime() + 1000), // 1 second after
      true
    );
    
    return occurrences.length > 0;
  } catch (error) {
    console.error('Error checking occurrence:', error);
    return false;
  }
}

/**
 * Calculate the actual end date for a series with count-based ending
 */
export function calculateSeriesEndDate(
  recurrenceRule: RecurrenceRule,
  seriesStart: Date
): Date | null {
  if (recurrenceRule.endType === 'on_date' && recurrenceRule.endDate) {
    return new Date(recurrenceRule.endDate);
  }

  if (recurrenceRule.endType === 'after_count' && recurrenceRule.endCount) {
    try {
      const occurrences = getOccurrences(recurrenceRule, seriesStart, recurrenceRule.endCount);
      return occurrences[occurrences.length - 1] || null;
    } catch (error) {
      console.error('Error calculating series end date:', error);
      return null;
    }
  }

  // 'never' case
  return null;
}
