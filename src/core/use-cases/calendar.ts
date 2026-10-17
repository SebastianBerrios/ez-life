import { DomainError } from '../domain/errors/DomainError';
export function calendarKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('La fecha no es válida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (calendarKey(date) !== value) throw new DomainError('La fecha no es válida.');
  return date;
}
export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return start;
}
/** Local wall-clock time as `HH:mm`. */
export function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
/** Combines a local `YYYY-MM-DD` key and a local `HH:mm` time into one Date. */
export function combineDateAndTime(dateKey: string, time: string): Date {
  const base = parseCalendarDate(dateKey);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  const hours = match ? Number(match[1]) : NaN;
  const minutes = match ? Number(match[2]) : NaN;
  if (!match || hours > 23 || minutes > 59) throw new DomainError('La hora no es válida.');
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes);
}
/** First day of the month `delta` months away from `date` (negative = earlier). */
export function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}
/** Capitalized es-PE month label, e.g. `Octubre 2026`. */
export function formatCycleLabel(date: Date): string {
  const month = date.toLocaleDateString('es-PE', { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}

/** Local midnight of the calendar day `date` falls on. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Moves `date` by whole LOCAL calendar days, keeping its wall-clock time (DST-safe, unlike adding 24h of ms). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

/** Whole local calendar days from `from` to `to` (negative when `to` is earlier); time of day is ignored. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export interface WeekWindow {
  /** Local midnight of the Monday. */
  start: Date;
  /** Local midnight of the following Monday (exclusive end). */
  end: Date;
  /** The seven local days Monday..Sunday, each at local midnight. */
  days: Date[];
}

/** The Monday-Sunday week (local) containing `today`. */
export function weekWindow(today: Date): WeekWindow {
  const start = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return { start, end: addDays(start, 7), days };
}
