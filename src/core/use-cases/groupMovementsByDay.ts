import { calendarKey } from './calendar';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface DayGroup<T> {
  /** Local calendar day, `YYYY-MM-DD`. */
  key: string;
  label: string;
  items: T[];
}

/** "Hoy, 16 de octubre 2026", "Ayer, 15 de octubre 2026" or "1 de octubre 2026" (deterministic, local calendar days). */
export function formatDayLabel(date: Date, today: Date): string {
  const long = `${date.getDate()} de ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  const key = calendarKey(date);
  if (key === calendarKey(today)) return `Hoy, ${long}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === calendarKey(yesterday)) return `Ayer, ${long}`;
  return long;
}

/** Groups items by local calendar day, keeping the incoming order of items and of groups (first occurrence). */
export function groupByDay<T extends { date: Date }>(items: readonly T[], today: Date): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const key = calendarKey(item.date);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: formatDayLabel(item.date, today), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
