import { Movement, SavingsGoal } from '../domain/models/types';

export interface SavingsGoalProgress {
  currentAmountCents: number;
  percentage: number;
}

/**
 * Sums every EXPENSE movement assigned to a savings goal and returns the raw
 * progress percentage against its target. Unlike a display helper, this does
 * NOT cap the percentage at 100 — callers that only want a visual progress
 * bar (e.g. SavingsGoalList) should apply `Math.min(percentage, 100)`
 * themselves, while callers that need to detect the goal being reached or
 * exceeded (e.g. evaluateNotifications) need the real value.
 */
export function calculateSavingsGoalProgress(
  goal: SavingsGoal,
  movements: Movement[]
): SavingsGoalProgress {
  const currentAmountCents = movements
    .filter(m => m.type === 'EXPENSE' && m.savings_goal_id === goal.id)
    .reduce((acc, m) => acc + m.amount, 0);

  const percentage = goal.target_amount > 0
    ? (currentAmountCents / goal.target_amount) * 100
    : 0;

  return { currentAmountCents, percentage };
}
