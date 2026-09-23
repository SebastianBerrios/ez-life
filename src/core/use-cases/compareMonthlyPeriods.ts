import { Movement } from '../domain/models/types';

export interface PeriodTotals {
  income: number; // cents
  expense: number; // cents
  balance: number; // cents
}

export interface PeriodComparison {
  current: PeriodTotals;
  previous: PeriodTotals | null; // null if there is no data for the previous period
  delta: PeriodTotals | null; // current - previous, null when previous is null
}

function totalsFor(movements: Movement[]): PeriodTotals {
  const income = movements.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0);
  const expense = movements.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0);
  return { income, expense, balance: income - expense };
}

/**
 * Current vs. previous period comparison (FR-003). Pure function: the caller
 * (Dashboard.tsx) supplies both periods' already-loaded movements — this
 * never fetches data itself (Principio III).
 *
 * `previous`/`delta` are null when there is no previous-period data (spec.md
 * Edge Cases — "no muestra una comparación period-over-period rota"), e.g.
 * the user's first month of usage.
 */
export function compareMonthlyPeriods(current: Movement[], previous: Movement[]): PeriodComparison {
  const currentTotals = totalsFor(current);

  if (previous.length === 0) {
    return { current: currentTotals, previous: null, delta: null };
  }

  const previousTotals = totalsFor(previous);
  const delta: PeriodTotals = {
    income: currentTotals.income - previousTotals.income,
    expense: currentTotals.expense - previousTotals.expense,
    balance: currentTotals.balance - previousTotals.balance,
  };

  return { current: currentTotals, previous: previousTotals, delta };
}
