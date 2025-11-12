import { Sun, Clock3, Moon, FileText, LucideIcon } from 'lucide-react';
import { TaskGroup, isValidTaskGroup } from '@/types/taskGroup';
import { Task } from '@/types/task';

/**
 * Get the icon component for a task group
 */
export const getTaskGroupIcon = (group: TaskGroup): LucideIcon => {
  switch (group) {
    case 'morning': return Sun;
    case 'midday': return Clock3;
    case 'afternoon': return Clock3;
    case 'evening': return Moon;
    case 'general': return FileText;
  }
};

/**
 * Get the display title for a task group
 */
export const getTaskGroupTitle = (group: TaskGroup): string => {
  switch (group) {
    case 'morning': return 'Morning';
    case 'midday': return 'Midday';
    case 'afternoon': return 'Afternoon';
    case 'evening': return 'Evening';
    case 'general': return 'General';
  }
};

/**
 * Get the time range description for a task group
 */
export const getTaskGroupTimeRange = (group: TaskGroup): string => {
  switch (group) {
    case 'morning': return 'until 11 AM';
    case 'midday': return '11 AM - 3 PM';
    case 'afternoon': return '3 PM - 6 PM';
    case 'evening': return '6 PM onwards';
    case 'general': return 'any time';
  }
};

/**
 * Determine if a task group should be open by default based on current time
 */
export const shouldGroupBeOpenByDefault = (group: TaskGroup): boolean => {
  const now = new Date();
  const hour = now.getHours();
  
  switch (group) {
    case 'morning': return hour >= 6 && hour < 12;
    case 'midday': return hour >= 11 && hour < 16;
    case 'afternoon': return hour >= 15 && hour < 19;
    case 'evening': return hour >= 18 || hour < 6;
    case 'general': return true; // Always open
  }
};

/**
 * Get the due date for a task based on its group (for today)
 */
export const getGroupDueDate = (group: TaskGroup): string | null => {
  const today = new Date();
  
  switch (group) {
    case 'morning':
      // Set to 11 AM today
      const morning = new Date(today);
      morning.setHours(11, 0, 0, 0);
      return morning.toISOString();
    case 'midday':
      // Set to 3 PM today
      const midday = new Date(today);
      midday.setHours(15, 0, 0, 0);
      return midday.toISOString();
    case 'afternoon':
      // Set to 6 PM today
      const afternoon = new Date(today);
      afternoon.setHours(18, 0, 0, 0);
      return afternoon.toISOString();
    case 'evening':
      // Set to 11:59 PM today
      const evening = new Date(today);
      evening.setHours(23, 59, 0, 0);
      return evening.toISOString();
    case 'general':
    default:
      return null; // No specific due date for general tasks
  }
};

/**
 * Determine task group from a task's properties
 * Priority 1: Use task_group field if explicitly set
 * Priority 2: Fall back to due_date calculation for backwards compatibility
 */
export const getTaskGroup = (task: Task): TaskGroup => {
  // Priority 1: Use task_group field if explicitly set
  if (task.task_group && isValidTaskGroup(task.task_group)) {
    return task.task_group as TaskGroup;
  }
  
  // Priority 2: Fall back to due_date calculation for backwards compatibility
  if (!task.due_date) return 'general';
  
  const dueDate = new Date(task.due_date);
  const hour = dueDate.getHours();
  
  if (hour >= 0 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'general';
};

/**
 * Group tasks by their task group
 */
export const groupTasksByTime = (tasks: Task[]): Record<TaskGroup, Task[]> => {
  const groups: Record<TaskGroup, Task[]> = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: [],
    general: []
  };
  
  tasks.forEach(task => {
    const group = getTaskGroup(task);
    groups[group].push(task);
  });
  
  return groups;
};

/**
 * All task groups in display order
 */
export const TASK_GROUPS_ORDER: TaskGroup[] = ['morning', 'midday', 'afternoon', 'evening', 'general'];
