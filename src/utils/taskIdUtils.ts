/**
 * Utility functions for working with task IDs, including detection
 * of virtual/recurring task IDs vs real database UUIDs.
 */

// Standard UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID (36 characters, proper format)
 */
export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return id.length === 36 && UUID_REGEX.test(id);
}

/**
 * Check if a task ID is a virtual/composite ID (e.g., "UUID-YYYY-MM-DD")
 * Virtual task IDs are longer than 36 characters and contain a date suffix
 */
export function isVirtualTaskId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  // Virtual IDs have format: UUID-YYYY-MM-DD (47 characters total)
  // or could be other composite formats
  if (id.length <= 36) return false;
  
  // Check if it contains a date-like suffix after a UUID
  const datePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}$/i;
  return datePattern.test(id);
}

/**
 * Parse a virtual task ID to extract the series ID and occurrence date
 */
export function parseVirtualTaskId(id: string): { seriesId: string; occurrenceDate: string } | null {
  if (!isVirtualTaskId(id)) return null;
  
  // Extract UUID (first 36 chars) and date (last 10 chars: YYYY-MM-DD)
  const seriesId = id.substring(0, 36);
  const occurrenceDate = id.substring(37); // Skip the hyphen after UUID
  
  return { seriesId, occurrenceDate };
}

/**
 * Check if a task can be updated via direct database operations
 * Returns false for virtual tasks that need special handling
 */
export function canUpdateTaskDirectly(taskId: string | null | undefined, isVirtual?: boolean): boolean {
  // If explicitly marked as virtual, it cannot be updated directly
  if (isVirtual === true) return false;
  
  // Check if the ID format indicates a virtual task
  if (isVirtualTaskId(taskId)) return false;
  
  // Must be a valid UUID to update directly
  return isValidUuid(taskId);
}
