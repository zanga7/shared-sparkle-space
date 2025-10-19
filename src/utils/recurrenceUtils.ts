import { 
  RecurrenceRule, 
  RecurrencePreview, 
  RecurrencePreset, 
  WeekdayKey,
  TaskRecurrenceOptions,
  EventRecurrenceOptions
} from '@/types/recurrence';
import { addDays, addWeeks, addMonths, addYears, format, startOfDay, isWeekend } from 'date-fns';

// Convert weekday names to date-fns day numbers (0 = Sunday, 1 = Monday, etc.)
const weekdayToNumber = (weekday: WeekdayKey): number => {
  const mapping: Record<WeekdayKey, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  return mapping[weekday];
};

// Get weekday name from date
const getWeekdayKey = (date: Date): WeekdayKey => {
  const dayNames: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getDay()];
};

// Create a recurrence rule from preset
export const createRuleFromPreset = (preset: RecurrencePreset, referenceDate?: Date): RecurrenceRule => {
  const baseRule: RecurrenceRule = {
    frequency: 'daily',
    interval: 1,
    endType: 'never'
  };

  switch (preset) {
    case 'every_day':
      return { ...baseRule, frequency: 'daily' };
    
    case 'school_days':
      return { 
        ...baseRule, 
        frequency: 'weekly',
        weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      };
    
    case 'weekends':
      return { 
        ...baseRule, 
        frequency: 'weekly',
        weekdays: ['saturday', 'sunday']
      };
    
    case 'every_week':
      const weekday = referenceDate ? getWeekdayKey(referenceDate) : 'monday';
      return { 
        ...baseRule, 
        frequency: 'weekly',
        weekdays: [weekday]
      };
    
    case 'every_month':
      return { 
        ...baseRule, 
        frequency: 'monthly',
        monthlyType: 'on_day',
        monthDay: referenceDate ? referenceDate.getDate() : 1
      };
    
    case 'every_year':
      return { ...baseRule, frequency: 'yearly' };
    
    case 'custom':
    default:
      return baseRule;
  }
};

// Generate next occurrence based on rule
export const getNextOccurrence = (
  lastDate: Date, 
  rule: RecurrenceRule, 
  options?: { skipWeekends?: boolean; isFromCompletion?: boolean }
): Date => {
  let nextDate = new Date(lastDate);

  switch (rule.frequency) {
    case 'daily':
      nextDate = addDays(nextDate, rule.interval);
      break;
    
    case 'weekly':
      if (rule.weekdays && rule.weekdays.length > 0) {
        // Find next occurrence on specified weekdays
        const currentWeekday = nextDate.getDay();
        const targetWeekdays = rule.weekdays.map(weekdayToNumber).sort();
        
        // Find next weekday in this week or next
        let foundNextDay = false;
        for (const targetDay of targetWeekdays) {
          if (targetDay > currentWeekday) {
            nextDate = addDays(nextDate, targetDay - currentWeekday);
            foundNextDay = true;
            break;
          }
        }
        
        if (!foundNextDay) {
          // Go to next week and first target weekday
          const daysToFirstTarget = 7 - currentWeekday + targetWeekdays[0];
          nextDate = addDays(nextDate, daysToFirstTarget);
          
          // Add additional weeks if interval > 1
          if (rule.interval > 1) {
            nextDate = addWeeks(nextDate, rule.interval - 1);
          }
        }
      } else {
        nextDate = addWeeks(nextDate, rule.interval);
      }
      break;
    
    case 'monthly':
      if (rule.monthlyType === 'on_weekday' && rule.weekdayOrdinal && rule.weekdayName) {
        // Handle "first Monday", "last Friday" etc.
        nextDate = addMonths(nextDate, rule.interval);
        // Implementation for ordinal weekdays would go here
      } else {
        nextDate = addMonths(nextDate, rule.interval);
        if (rule.monthDay) {
          nextDate.setDate(Math.min(rule.monthDay, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        }
      }
      break;
    
    case 'yearly':
      nextDate = addYears(nextDate, rule.interval);
      break;
  }

  // Skip weekends if requested
  if (options?.skipWeekends && isWeekend(nextDate)) {
    // Move to next Monday
    const daysToMonday = 8 - nextDate.getDay();
    nextDate = addDays(nextDate, daysToMonday);
  }

  return nextDate;
};

// Generate preview of recurrence
export const generateRecurrencePreview = (
  startDate: Date,
  rule: RecurrenceRule,
  taskOptions?: TaskRecurrenceOptions,
  eventOptions?: EventRecurrenceOptions
): RecurrencePreview => {
  const nextOccurrences: Date[] = [];
  const warnings: string[] = [];

  // Show up to 3, starting WITH the first scheduled occurrence (startDate)
  const maxToShow = 3;
  let currentDate = new Date(startDate);
  let produced = 0;

  // Respect end conditions
  const totalAllowed = (rule.endType === 'after_count' && rule.endCount)
    ? rule.endCount
    : Number.POSITIVE_INFINITY;
  const untilDate = (rule.endType === 'on_date' && rule.endDate)
    ? new Date(rule.endDate)
    : null;

  while (produced < maxToShow && produced < totalAllowed) {
    // Stop if we've passed the end date
    if (untilDate && currentDate > untilDate) break;

    // Include the current occurrence
    nextOccurrences.push(new Date(currentDate));
    produced++;

    // Generate the next occurrence if we still need more
    if (produced < maxToShow && produced < totalAllowed) {
      currentDate = getNextOccurrence(currentDate, rule, {
        skipWeekends: taskOptions?.skipWeekends,
        isFromCompletion: taskOptions?.repeatFrom === 'completion'
      });
    }

    // Safety break
    if (produced > 1000) {
      warnings.push('Preview limited to prevent infinite loop');
      break;
    }
  }

  // Generate human-readable summary
  const summary = generateSummaryText(rule, startDate, taskOptions);

  // Add warnings for edge cases
  if (rule.frequency === 'monthly' && rule.monthDay && rule.monthDay > 28) {
    warnings.push('Some months may not have day ' + rule.monthDay);
  }

  if (taskOptions?.rotateBetweenMembers && (!taskOptions.memberOrder || taskOptions.memberOrder.length < 2)) {
    warnings.push('Member rotation requires at least 2 assigned members');
  }

  return {
    summary,
    nextOccurrences,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

// Generate human-readable summary
export const generateSummaryText = (
  rule: RecurrenceRule, 
  startDate: Date,
  taskOptions?: TaskRecurrenceOptions
): string => {
  // Validate startDate
  if (!startDate || isNaN(startDate.getTime())) {
    return 'Invalid date provided';
  }

  let frequency = '';
  
  switch (rule.frequency) {
    case 'daily':
      frequency = rule.interval === 1 ? 'every day' : `every ${rule.interval} days`;
      break;
    
    case 'weekly':
      if (rule.weekdays && rule.weekdays.length > 0) {
        const dayNames = rule.weekdays.map(day => 
          day.charAt(0).toUpperCase() + day.slice(1, 3)
        ).join(', ');
        frequency = rule.interval === 1 
          ? `every week on ${dayNames}`
          : `every ${rule.interval} weeks on ${dayNames}`;
      } else {
        frequency = rule.interval === 1 ? 'every week' : `every ${rule.interval} weeks`;
      }
      break;
    
    case 'monthly':
      if (rule.monthlyType === 'on_day' && rule.monthDay) {
        frequency = rule.interval === 1 
          ? `every month on the ${rule.monthDay}`
          : `every ${rule.interval} months on the ${rule.monthDay}`;
      } else {
        frequency = rule.interval === 1 ? 'every month' : `every ${rule.interval} months`;
      }
      break;
    
    case 'yearly':
      frequency = rule.interval === 1 ? 'every year' : `every ${rule.interval} years`;
      break;
  }
  
  // Add time if provided
  const timeStr = format(startDate, 'h:mm a');
  const summary = `${frequency} at ${timeStr}`;
  
  // Add end condition
  let endCondition = '';
  if (rule.endType === 'on_date' && rule.endDate) {
    const endDate = new Date(rule.endDate);
    if (!isNaN(endDate.getTime())) {
      endCondition = `, ends ${format(endDate, 'MMM d, yyyy')}`;
    }
  } else if (rule.endType === 'after_count' && rule.endCount) {
    endCondition = `, ends after ${rule.endCount} times`;
  }
  
  // Add task-specific options
  let taskSpecific = '';
  if (taskOptions?.rotateBetweenMembers) {
    taskSpecific += ', rotating between assigned members';
  }
  if (taskOptions?.skipWeekends) {
    taskSpecific += ', skipping weekends';
  }
  if (taskOptions?.pauseDuringHolidays) {
    taskSpecific += ', pausing during holidays';
  }
  
  return summary + endCondition + taskSpecific;
};

// Validate recurrence rule
export const validateRecurrenceRule = (rule: RecurrenceRule): string[] => {
  const errors: string[] = [];
  
  if (rule.interval < 1) {
    errors.push('Interval must be at least 1');
  }
  
  if (rule.frequency === 'weekly' && rule.weekdays && rule.weekdays.length === 0) {
    errors.push('At least one weekday must be selected for weekly recurrence');
  }
  
  if (rule.frequency === 'monthly' && rule.monthlyType === 'on_day' && rule.monthDay) {
    if (rule.monthDay < 1 || rule.monthDay > 31) {
      errors.push('Month day must be between 1 and 31');
    }
  }
  
  if (rule.endType === 'after_count' && rule.endCount && rule.endCount < 1) {
    errors.push('End count must be at least 1');
  }
  
  if (rule.endType === 'on_date' && rule.endDate) {
    if (new Date(rule.endDate) <= new Date()) {
      errors.push('End date must be in the future');
    }
  }
  
  return errors;
};