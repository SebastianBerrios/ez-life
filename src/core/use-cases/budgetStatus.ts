export type BudgetStatus = 'ok' | 'warning' | 'over';

/** Same threshold as the 80% budget notification (`evaluateNotifications`). */
export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;

/** Maps spent/budget (as a percentage, may exceed 100) to the 3-level semaphore. */
export function budgetStatusFor(progressPercent: number): BudgetStatus {
  if (progressPercent > 100) return 'over';
  if (progressPercent >= BUDGET_WARNING_THRESHOLD_PERCENT) return 'warning';
  return 'ok';
}
