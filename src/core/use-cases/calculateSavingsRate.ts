export const MIN_SAVINGS_RATE = -999;
export const MAX_SAVINGS_RATE = 100;

/**
 * Savings rate of a cycle as an integer percent: (income - expense) / income, rounded.
 * Returns `null` when there is no income (the rate is undefined, never shown as 0 or Infinity).
 * Clamped to [-999, 100]: it can never exceed 100 (expense >= 0) and a huge overspend is shown as
 * "-999%" instead of an unreadable figure.
 */
export function calculateSavingsRate(incomeCents: number, expenseCents: number): number | null {
  if (!(incomeCents > 0)) return null;
  const rate = Math.round(((incomeCents - expenseCents) * 100) / incomeCents);
  return Math.min(MAX_SAVINGS_RATE, Math.max(MIN_SAVINGS_RATE, rate));
}
