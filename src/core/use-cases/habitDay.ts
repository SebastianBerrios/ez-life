import type { DayOfWeek, Habit, HabitCompletion } from '../domain/models/types';
import { addDays, calendarKey, startOfDay, weekWindow } from './calendar';

const DAY_CODES: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Single home of the habit "which day is it" rules. EVERYTHING here is LOCAL-day based: a habit
 * completion is a calendar day, not an instant. It is stored as the instant of the tap (or local
 * noon after a sync: `recordAdapter` pushes `calendarKey` and pulls `parseCalendarDate`), so it is
 * always compared through `calendarKey` (local `YYYY-MM-DD`), weekdays come from `getDay()` and
 * weeks are Monday-Sunday local. Nothing in here reads a UTC getter, so in UTC-5 after 19:00
 * "today" is still today.
 */

/** Weekday code of the LOCAL day `date` falls on. */
export function dayCode(date: Date): DayOfWeek {
  return DAY_CODES[date.getDay()];
}

/** Non-deleted completions grouped by their local day key. */
export function groupCompletionsByDay(completions: HabitCompletion[]): Map<string, HabitCompletion[]> {
  const byDay = new Map<string, HabitCompletion[]>();
  for (const completion of completions) {
    if (completion.deleted_at) continue;
    const key = calendarKey(completion.date);
    const list = byDay.get(key);
    if (list) list.push(completion);
    else byDay.set(key, [completion]);
  }
  return byDay;
}

export function wasHabitCompletedOnDay(completions: HabitCompletion[], day: Date): boolean {
  const key = calendarKey(day);
  return completions.some(c => !c.deleted_at && calendarKey(c.date) === key);
}

/** Completions that fall in the Monday-Sunday (local) week containing `day`. */
export function countCompletionsInWeekOf(completions: HabitCompletion[], day: Date): number {
  const { start, end } = weekWindow(day);
  const startKey = calendarKey(start);
  const endKey = calendarKey(end);
  return completions.filter(c => {
    if (c.deleted_at) return false;
    const key = calendarKey(c.date);
    return key >= startKey && key < endKey;
  }).length;
}

/** First local day (midnight) of the habit's history: its creation day, or an earlier completion. */
export function habitHistoryStart(habit: Habit, completions: HabitCompletion[]): Date {
  let start = startOfDay(habit.created_at);
  for (const completion of completions) {
    if (completion.deleted_at) continue;
    const day = startOfDay(completion.date);
    if (day < start) start = day;
  }
  return start;
}

export interface HabitDayState {
  scheduled: boolean;
  done: boolean;
}

/**
 * - fixed days: scheduled when the local weekday is in `fixed_days`.
 * - frequency: has no fixed day. Today it is scheduled while this week's target is unmet; on past
 *   days it only counts when it was completed (we cannot know it was "expected" then); future days never.
 * - days before the habit's creation day are never scheduled (a habit created on Friday has no
 *   missed Monday); a completion recorded there still counts as scheduled that day.
 * - a habit completed on a day always counts as scheduled that day (done never exceeds scheduled).
 */
export function habitStateOnDay(habit: Habit, completions: HabitCompletion[], day: Date, today: Date): HabitDayState {
  const done = wasHabitCompletedOnDay(completions, day);
  let scheduled: boolean;
  if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
    scheduled = habit.fixed_days.includes(dayCode(day));
  } else {
    scheduled = calendarKey(day) === calendarKey(today) && countCompletionsInWeekOf(completions, day) < (habit.frequency_target ?? 1);
  }
  if (calendarKey(day) < calendarKey(habit.created_at)) scheduled = false;
  return { scheduled: scheduled || done, done };
}

export interface HabitDayCell {
  /** Local midnight of the day. */
  date: Date;
  scheduled: boolean;
  done: boolean;
}

/** The 7 local days ending today (oldest first), each with its scheduled/done state. */
export function habitLast7Days(habit: Habit, completions: HabitCompletion[], today: Date): HabitDayCell[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfDay(today), index - 6);
    return { date, ...habitStateOnDay(habit, completions, date, today) };
  });
}
