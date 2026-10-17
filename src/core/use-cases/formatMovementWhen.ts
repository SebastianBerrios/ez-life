import { calendarKey, timeKey } from './calendar';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Short, deterministic (no Intl) date-and-time label for lists: "Hoy, 13:42", "Ayer, 09:05" or
 * "01 oct, 09:00" (adds the year when it differs from `today`'s). Local calendar days.
 */
export function formatMovementWhen(date: Date, today: Date): string {
  const time = timeKey(date);
  const key = calendarKey(date);
  if (key === calendarKey(today)) return `Hoy, ${time}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === calendarKey(yesterday)) return `Ayer, ${time}`;
  const year = date.getFullYear() === today.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}${year}, ${time}`;
}

/** "16 oct 2026" (local calendar day, deterministic). */
export function formatShortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
