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
  exdates?: Date[]; // NEW: EXDATE array from series column
  maxInstances?: number;
}

export interface GeneratedInstance {
  date: Date;
  isException: boolean;
  exceptionType?: 'skip' | 'override';
  overrideData?: any;
}

// Convert a local date to UTC date-only (00:00:00 UTC on that calendar day)
const toUTCDateOnly = (d: Date): Date => new Date(
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
);

const parseLocalDateString = (dateStr: string): Date => {
  const [y, m, dd] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, dd || 1, 0, 0, 0, 0));
};

// Ensure any RRULE string won't force UTC DTSTART parsing
const stripDTSTART = (s: string): string =>
  s.split('\n').filter((l) => !l.startsWith('DTSTART')).join('\n');

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
    exdates = [],
    maxInstances = 1000,
  } = options;

  try {
    // Create RRULE string from recurrence rule using the series' true start
    const rawRruleString = toRRULE(recurrenceRule, seriesStart);
    const rruleString = stripDTSTART(rawRruleString);
    
    // Create RRuleSet to handle exceptions
    const rruleSet = new RRuleSet();
    
    // Add the main recurrence rule with UTC date-only DTSTART
    const dtstartUTC = toUTCDateOnly(seriesStart);
    const mainRule = rrulestr(rruleString, { dtstart: dtstartUTC });
    rruleSet.rrule(mainRule);

    // Add exception dates (EXDATE) from both exceptions table AND exdates column
    const skipExceptions = exceptions.filter(ex => ex.exception_type === 'skip');
    skipExceptions.forEach(ex => {
      // exception_date is 'YYYY-MM-DD' => parse as UTC date-only
      const exDate = parseLocalDateString(ex.exception_date);
      rruleSet.exdate(exDate);
    });
    
    // Add exdates from series column (for calendar export compatibility)
    exdates.forEach(exdate => {
      rruleSet.exdate(toUTCDateOnly(exdate));
    });

    // Generate all instances within the date range (use UTC window)
    const startUTC = toUTCDateOnly(startDate);
    const endUTC = new Date(Date.UTC(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23, 59, 59, 999
    ));
    
    const instances = rruleSet.between(startUTC, endUTC, true);

    // Limit to max instances for performance
    const limitedInstances = instances.slice(0, maxInstances);

    // Map to GeneratedInstance format - convert UTC occurrences to local date-only
    const result: GeneratedInstance[] = limitedInstances.map(utcOcc => {
      // Extract the UTC calendar day and create a local date for it
      const localDay = new Date(
        utcOcc.getUTCFullYear(),
        utcOcc.getUTCMonth(),
        utcOcc.getUTCDate()
      );
      
      // Use timezone-safe date formatting for local-day matching
      const dateStr = format(localDay, 'yyyy-MM-dd');
      
      // Check if this date has an override exception
      const overrideException = exceptions.find(
        ex => ex.exception_type === 'override' && 
              ex.exception_date === dateStr
      );

      if (overrideException) {
        return {
          date: localDay,
          isException: true,
          exceptionType: 'override',
          overrideData: overrideException.override_data,
        };
      }

      return {
        date: localDay,
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
    const rawRruleString = toRRULE(recurrenceRule, seriesStart);
    const rruleString = stripDTSTART(rawRruleString);
    const dtstartUTC = toUTCDateOnly(seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: dtstartUTC });
    
    const afterUTC = toUTCDateOnly(afterDate);
    const nextUTC = rrule.after(afterUTC, true);
    
    if (!nextUTC) return null;
    
    // Convert UTC occurrence to local date-only
    return new Date(
      nextUTC.getUTCFullYear(),
      nextUTC.getUTCMonth(),
      nextUTC.getUTCDate()
    );
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
    const rawRruleString = toRRULE(recurrenceRule, seriesStart);
    const rruleString = stripDTSTART(rawRruleString);
    const dtstartUTC = toUTCDateOnly(seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: dtstartUTC });
    
    const utcOccurrences = rrule.all((_, i) => i < count);
    
    // Convert UTC occurrences to local date-only
    return utcOccurrences.map(utcOcc => new Date(
      utcOcc.getUTCFullYear(),
      utcOcc.getUTCMonth(),
      utcOcc.getUTCDate()
    ));
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
    const rawRruleString = toRRULE(recurrenceRule, seriesStart);
    const rruleString = stripDTSTART(rawRruleString);
    const dtstartUTC = toUTCDateOnly(seriesStart);
    const rrule = rrulestr(rruleString, { dtstart: dtstartUTC });
    
    // Check if the date matches any occurrence using UTC window
    const targetUTC = toUTCDateOnly(date);
    const occurrences = rrule.between(
      targetUTC,
      new Date(targetUTC.getTime() + 86400000 - 1), // end of UTC day
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
