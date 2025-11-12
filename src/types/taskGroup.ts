// Centralized TaskGroup type definition
export type TaskGroup = 'morning' | 'midday' | 'afternoon' | 'evening' | 'general';

// Valid task groups for validation
export const VALID_TASK_GROUPS: TaskGroup[] = ['morning', 'midday', 'afternoon', 'evening', 'general'];

// All task groups in display order
export const TASK_GROUPS_ORDER: TaskGroup[] = ['morning', 'midday', 'afternoon', 'evening', 'general'];

// Check if a string is a valid task group
export const isValidTaskGroup = (value: string): value is TaskGroup => {
  return VALID_TASK_GROUPS.includes(value as TaskGroup);
};
