import type { Movement, SavingsGoal } from '../domain/models/types';
import { calendarKey } from './calendar';
import { calculateSavingsGoalProgress } from './calculateSavingsGoalProgress';

export interface PrimarySavingsGoal {
  goal: SavingsGoal;
  currentAmountCents: number;
  /** Raw percentage (< 100 by construction). */
  percentage: number;
  remainingCents: number;
}

/**
 * The "Meta principal": among ACTIVE savings goals (not deleted, deadline not before today, below
 * 100%) the one with the highest progress; ties go to the nearest deadline (no deadline last),
 * then by name. `null` when there is none.
 */
export function pickPrimarySavingsGoal(goals: SavingsGoal[], movements: Movement[], today: Date): PrimarySavingsGoal | null {
  const todayKey = calendarKey(today);
  const candidates = goals
    .filter(goal => !goal.deleted_at && goal.target_amount > 0 && (!goal.deadline || calendarKey(goal.deadline) >= todayKey))
    .map(goal => ({ goal, ...calculateSavingsGoalProgress(goal, movements) }))
    .filter(entry => entry.percentage < 100);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    b.percentage - a.percentage
    || (a.goal.deadline?.getTime() ?? Infinity) - (b.goal.deadline?.getTime() ?? Infinity)
    || a.goal.name.localeCompare(b.goal.name));

  const best = candidates[0];
  return {
    goal: best.goal,
    currentAmountCents: best.currentAmountCents,
    percentage: best.percentage,
    remainingCents: Math.max(0, best.goal.target_amount - best.currentAmountCents),
  };
}
