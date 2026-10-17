import type { Habit, HabitCompletion } from '../domain/models/types';
import { addDays } from './calendar';
import { buildFixedDaysLog, buildFrequencyWeeks, evaluateFixedDaysStreak, evaluateFrequencyStreak, isHabitScheduledToday } from './evaluateHabitStreak';
import { wasHabitCompletedOnDay } from './habitDay';

export interface HabitStreakInfo {
  streak: number;
  /** Fixed-days habits count scheduled days; frequency habits count weeks. */
  unit: 'days' | 'weeks';
  tokensAvailable: number;
  /** A (non-deleted) completion exists for today's LOCAL day, for either schedule mode. */
  completedToday: boolean;
  scheduledToday: boolean;
}

/**
 * Streak assembly shared by the Control habit cards, HabitDashboard and the Inicio "Foco de Hoy".
 * Every day comparison is local (`habitDay.ts`), so no caller has to re-anchor dates.
 *
 * - fixed days: the log covers every scheduled local day from the habit's creation to `today`
 *   (a scheduled `today` that is still open counts as a miss: see `currentHabitStreak`).
 * - frequency: the streak is the number of consecutive FULL Monday-Sunday (local) weeks that met
 *   `frequency_target`; the week in progress and the partial week of creation only count once met
 *   (`buildFrequencyWeeks`). `unit` is 'weeks'.
 */
export function buildHabitStreak(habit: Habit, completions: HabitCompletion[], today: Date): HabitStreakInfo {
  const scheduledToday = isHabitScheduledToday(habit, completions, today);
  const completedToday = wasHabitCompletedOnDay(completions, today);

  if (habit.schedule_mode === 'fixed_days' && habit.fixed_days) {
    const log = buildFixedDaysLog(habit.fixed_days, completions, habit.created_at, today);
    const { streak, tokensAvailable } = evaluateFixedDaysStreak(log);
    return { streak, unit: 'days', tokensAvailable, completedToday, scheduledToday };
  }

  const { streak, tokensAvailable } = evaluateFrequencyStreak(buildFrequencyWeeks(habit, completions, today));
  return { streak, unit: 'weeks', tokensAvailable, completedToday, scheduledToday };
}

/**
 * The streak to DISPLAY: a fixed-days habit that is still open today shows the run today would
 * extend (through yesterday: the evaluator would reset it to 0 while today is open); once done it
 * includes today. Frequency habits need no such shift (an open week never resets the streak).
 */
export function currentHabitStreak(habit: Habit, completions: HabitCompletion[], today: Date): HabitStreakInfo {
  const info = buildHabitStreak(habit, completions, today);
  if (info.unit === 'weeks' || info.completedToday) return info;
  const through = buildHabitStreak(habit, completions, addDays(today, -1));
  return { ...info, streak: through.streak, tokensAvailable: through.tokensAvailable };
}
