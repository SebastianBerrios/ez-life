import { DayOfWeek, Task, UUID } from '../domain/models/types';
import { addDays, calendarKey } from './calendar';
import { dayCode } from './habitDay';

// Calendar-date arithmetic is done on LOCAL days (same rule as habitDay.ts): a due_date is a
// calendar day stored at local noon (`parseCalendarDate`) and pushed as its local `calendarKey`.
// UTC arithmetic produced UTC-midnight dates, which in UTC-5 are the PREVIOUS local day (the
// generated task landed a day early) and, east of UTC, could flip the weekday of a noon date.
const NOON = 12;

/** `date` moved by whole local days, normalized to local noon (the storage convention of due dates). */
function addLocalDays(date: Date, days: number): Date {
  const moved = addDays(date, days);
  return new Date(moved.getFullYear(), moved.getMonth(), moved.getDate(), NOON);
}

/**
 * Smallest strictly-future date (1 to 7 days ahead) whose weekday is in
 * `fixedDays`. `fixedDays` is guaranteed non-empty by TaskForm validation, so
 * this always resolves within 7 days.
 */
function nextFixedDayDueDate(fromDueDate: Date, fixedDays: DayOfWeek[]): Date {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = addLocalDays(fromDueDate, offset);
    if (fixedDays.includes(dayCode(candidate))) {
      return candidate;
    }
  }
  // Unreachable given a non-empty fixedDays, kept only as a safe fallback.
  return addLocalDays(fromDueDate, 7);
}

/**
 * Spreads `frequencyTarget` occurrences evenly across a 7-day week: the next
 * occurrence is `floor(7 / frequencyTarget)` days after the last one (at
 * least 1 day apart).
 */
function nextFrequencyDueDate(fromDueDate: Date, frequencyTarget: number): Date {
  const intervalDays = Math.max(1, Math.floor(7 / Math.max(1, frequencyTarget)));
  return addLocalDays(fromDueDate, intervalDays);
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return calendarKey(a) === calendarKey(b);
}

export type NewTaskOccurrence = Omit<Task, 'id' | 'created_at' | 'updated_at'>;

/**
 * Data-generation engine for recurring Task occurrences (research.md §2) —
 * intentionally separate from useRecurrenceEvaluator (Movement-only,
 * monthly) and from the Notification pipeline (Principio XI: generating a
 * Task row is a data change, not a reminder).
 *
 * For each recurrence series (grouped by `recurrence_series_id`), reads the
 * MOST RECENT occurrence (by due_date) to decide whether the next one is due
 * (data-model.md): if `recurrence_active !== false` and the computed next
 * due date is `<= today` and doesn't already exist in the series, returns it
 * as a new occurrence to create. Editing schedule fields on the most recent
 * occurrence therefore only affects future generation (FR-005); cancelling
 * (`recurrence_active: false`) stops generation entirely (FR-004).
 */
export function evaluateTaskRecurrence(tasks: Task[], today: Date): NewTaskOccurrence[] {
  const bySeries = new Map<UUID, Task[]>();
  for (const task of tasks) {
    if (!task.recurrence_series_id) continue;
    const list = bySeries.get(task.recurrence_series_id) ?? [];
    list.push(task);
    bySeries.set(task.recurrence_series_id, list);
  }

  const newOccurrences: NewTaskOccurrence[] = [];

  for (const occurrences of Array.from(bySeries.values())) {
    const latest = occurrences.reduce((a, b) => (a.due_date > b.due_date ? a : b));

    if (latest.recurrence_active === false) continue;
    if (!latest.schedule_mode) continue;

    const nextDueDate =
      latest.schedule_mode === 'fixed_days' && latest.fixed_days
        ? nextFixedDayDueDate(latest.due_date, latest.fixed_days)
        : latest.schedule_mode === 'frequency'
        ? nextFrequencyDueDate(latest.due_date, latest.frequency_target ?? 1)
        : undefined;

    // Due once its local day has arrived (the day, not the noon instant, decides).
    if (!nextDueDate || calendarKey(nextDueDate) > calendarKey(today)) continue;

    const alreadyExists = occurrences.some(o => sameCalendarDay(o.due_date, nextDueDate));
    if (alreadyExists) continue;

    newOccurrences.push({
      user_id: latest.user_id,
      title: latest.title,
      description: latest.description,
      priority: latest.priority,
      tag: latest.tag,
      due_date: nextDueDate,
      status: 'pending',
      done_at: undefined,
      schedule_mode: latest.schedule_mode,
      fixed_days: latest.fixed_days,
      frequency_target: latest.frequency_target,
      recurrence_series_id: latest.recurrence_series_id,
      recurrence_active: latest.recurrence_active,
    });
  }

  return newOccurrences;
}
