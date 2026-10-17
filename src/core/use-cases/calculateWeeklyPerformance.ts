import type { Habit, HabitCompletion, Task } from '../domain/models/types';
import { calendarKey, startOfWeek } from './calendar';
import { habitStateOnDay } from './habitDay';

export interface DayPerformance {
  /** Local midnight of the day. */
  date: Date;
  done: number;
  scheduled: number;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Performance of the 7 days Monday-Sunday of the week containing `weekStart`, by LOCAL calendar day.
 * Per day: scheduled = habits scheduled that day (see `habitStateOnDay`) + tasks due that day;
 * done = those completed (habit completions of that day, tasks with status `done`).
 * `today` is injectable for deterministic tests; days after it are `isFuture` (and keep done = 0).
 */
export function calculateWeeklyPerformance(
  habits: Habit[],
  completionsByHabit: Record<string, HabitCompletion[]>,
  tasks: Task[],
  weekStart: Date,
  today: Date = new Date(),
): DayPerformance[] {
  const monday = startOfWeek(weekStart);
  const todayKey = calendarKey(today);
  const liveHabits = habits.filter(habit => !habit.deleted_at);
  const liveTasks = tasks.filter(task => !task.deleted_at);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const key = calendarKey(date);
    const isToday = key === todayKey;
    const isFuture = key > todayKey;

    let scheduled = 0;
    let done = 0;
    for (const habit of liveHabits) {
      const state = habitStateOnDay(habit, completionsByHabit[habit.id] ?? [], date, today);
      if (state.scheduled) scheduled += 1;
      if (state.done) done += 1;
    }
    for (const task of liveTasks) {
      if (calendarKey(task.due_date) !== key) continue;
      scheduled += 1;
      if (task.status === 'done') done += 1;
    }
    return { date, done: isFuture ? 0 : done, scheduled, isToday, isFuture };
  });
}

export interface WeekSummary {
  done: number;
  scheduled: number;
  /** Integer 0-100 over the days up to and including today; `null` when nothing was scheduled in them. */
  pct: number | null;
}

/** Totals of the elapsed part of the week (today included, future days excluded: they have no result yet). */
export function summarizeWeek(days: DayPerformance[]): WeekSummary {
  let done = 0;
  let scheduled = 0;
  for (const day of days) {
    if (day.isFuture) continue;
    done += day.done;
    scheduled += day.scheduled;
  }
  return { done, scheduled, pct: scheduled > 0 ? Math.round((done * 100) / scheduled) : null };
}
