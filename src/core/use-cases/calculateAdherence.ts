import type { Habit, HabitCompletion } from '../domain/models/types';
import { habitAdherence } from './calculateHabitCompletionRate';

/**
 * "Tasa de adherencia": the average of the 30-day completion rate of every live habit that has
 * something to measure yet (`habitAdherence`), as an integer percentage. `null` when there is no
 * such habit: never a made-up 0% or 100%.
 */
export function calculateAdherence(
  habits: Habit[],
  completionsByHabit: Record<string, HabitCompletion[]>,
  today: Date,
): number | null {
  const rates: number[] = [];
  for (const habit of habits) {
    if (habit.deleted_at) continue;
    const rate = habitAdherence(habit, completionsByHabit[habit.id] ?? [], today);
    if (rate !== null) rates.push(rate);
  }
  if (rates.length === 0) return null;
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
}
