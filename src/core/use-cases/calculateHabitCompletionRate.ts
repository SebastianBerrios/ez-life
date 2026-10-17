import { Habit, HabitCompletion } from '../domain/models/types';
import { addDays, calendarKey, daysBetween, startOfDay } from './calendar';
import { buildFixedDaysLog } from './evaluateHabitStreak';

const WINDOW_DAYS = 30;
const DAYS_PER_WEEK = 7;

/**
 * Rolling 30-day completion rate (SC-006) — deliberately never resets to
 * zero just because a streak broke; it's the non-punitive counterpart to
 * evaluateHabitStreak's racha, shown together on the habits dashboard.
 * The window is the last 30 LOCAL calendar days ending today (and no earlier than the habit's
 * creation day).
 */
export function calculateHabitCompletionRate(habit: Habit, completions: HabitCompletion[], today: Date): number {
  return habitAdherence(habit, completions, today) ?? 0;
}

/**
 * Same rate as `calculateHabitCompletionRate`, but `null` while the window holds nothing to measure
 * yet (a fixed-days habit with no scheduled day since its creation): a habit created minutes ago
 * has no adherence, not 0%.
 */
export function habitAdherence(habit: Habit, completions: HabitCompletion[], today: Date): number | null {
  const windowStart = addDays(startOfDay(today), -(WINDOW_DAYS - 1));
  const createdDay = startOfDay(habit.created_at);
  const effectiveStart = createdDay > windowStart ? createdDay : windowStart;

  if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
    const log = buildFixedDaysLog(habit.fixed_days, completions, effectiveStart, today);
    if (log.length === 0) return null;
    const completedCount = log.filter(d => d.completed).length;
    return Math.round((completedCount / log.length) * 100);
  }

  // Frequency mode: compare actual completions in the window against the
  // expected pace (target per week, prorated to the window's length).
  const target = habit.frequency_target ?? 1;
  const windowDays = daysBetween(effectiveStart, today) + 1;
  const expected = target * (windowDays / DAYS_PER_WEEK);
  if (expected <= 0) return null;

  const startKey = calendarKey(effectiveStart);
  const endKey = calendarKey(today);
  const actual = completions.filter(c => {
    if (c.deleted_at) return false;
    const key = calendarKey(c.date);
    return key >= startKey && key <= endKey;
  }).length;
  return Math.min(100, Math.round((actual / expected) * 100));
}
