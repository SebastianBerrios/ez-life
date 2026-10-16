type RecordData = Record<string, unknown>;
import { calendarKey, parseCalendarDate } from '../../core/use-cases/calendar';
const dateFields = new Set([
  'created_at', 'updated_at', 'deleted_at', 'date', 'deadline', 'due_date',
  'read_at', 'joined_at', 'left_at', 'expires_at', 'redeemed_at', 'done_at', 'completed_at',
]);
export function fromRemoteRecord(record: RecordData): RecordData {
  const result: RecordData = {};
  for (const [key, value] of Object.entries(record)) {
    if (dateFields.has(key) && value != null) {
      if (typeof value !== 'string' && !(value instanceof Date)) throw new Error(`Invalid remote date: ${key}`);
      const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseCalendarDate(value) : new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error(`Invalid remote date: ${key}`);
      result[key] = date;
    } else result[key] = value === null ? undefined : value;
  }
  if (typeof result.id !== 'string' || !(result.updated_at instanceof Date)) throw new Error('Invalid remote identity or timestamp');
  return result;
}
export function toRemoteRecord(record: RecordData, table?: string): RecordData {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key, value === undefined ? null : value instanceof Date
      ? ((table === 'tasks' && key === 'due_date') || (table === 'habit_completions' && key === 'date')) ? calendarKey(value) : value.toISOString()
      : value,
  ]));
}
