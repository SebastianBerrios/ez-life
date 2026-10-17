import type { Habit, HabitCompletion } from '../domain/models/types';
import type { HabitPendingToday } from './evaluateNotifications';
import { buildFixedDaysLog, evaluateFixedDaysStreak } from './evaluateHabitStreak';
import { dayCode } from './habitDay';

/**
 * Fixed-days habits scheduled today (LOCAL weekday) that are not done yet, with whether a streak
 * token is available to protect them. Feeds the daily-reminder notification.
 */
export function findHabitsPendingToday(
  habits: Habit[],
  completionsByHabit: Record<string, HabitCompletion[]>,
  today: Date,
): HabitPendingToday[] {
  const todayCode = dayCode(today);
  const pending: HabitPendingToday[] = [];
  for (const habit of habits) {
    if (habit.deleted_at || habit.schedule_mode !== 'fixed_days' || !habit.fixed_days?.includes(todayCode)) continue;

    const completions = completionsByHabit[habit.id] ?? [];
    const todayLog = buildFixedDaysLog(habit.fixed_days, completions, today, today);
    if (todayLog[0]?.completed) continue; // already done today

    const historyLog = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
    const { tokensAvailable } = evaluateFixedDaysStreak(historyLog.slice(0, -1)); // exclude today (not completed)
    pending.push({ habitId: habit.id, habitName: habit.name, hasTokensAvailable: tokensAvailable > 0 });
  }
  return pending;
}
