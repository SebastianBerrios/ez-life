import { Habit, HabitCompletion } from '../domain/models/types';
import { buildFixedDaysLog } from './evaluateHabitStreak';

const WINDOW_DAYS = 30;
const DAYS_PER_WEEK = 7;

/**
 * Rolling 30-day completion rate (SC-006) — deliberately never resets to
 * zero just because a streak broke; it's the non-punitive counterpart to
 * evaluateHabitStreak's racha, shown together on the habits dashboard.
 */
export function calculateHabitCompletionRate(habit: Habit, completions: HabitCompletion[], today: Date): number {
  const windowStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (WINDOW_DAYS - 1)));
  const effectiveStart = habit.created_at > windowStart ? habit.created_at : windowStart;

  if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
    const log = buildFixedDaysLog(habit.fixed_days, completions, effectiveStart, today);
    if (log.length === 0) return 0;
    const completedCount = log.filter(d => d.completed).length;
    return Math.round((completedCount / log.length) * 100);
  }

  // Frequency mode: compare actual completions in the window against the
  // expected pace (target per week, prorated to the window's length).
  const target = habit.frequency_target ?? 1;
  const windowDays = Math.round((today.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const expected = target * (windowDays / DAYS_PER_WEEK);
  if (expected <= 0) return 0;

  const actual = completions.filter(c => c.date >= effectiveStart && c.date <= today).length;
  return Math.min(100, Math.round((actual / expected) * 100));
}
