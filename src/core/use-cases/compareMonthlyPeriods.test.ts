import { describe, it, expect } from 'vitest';
import { compareMonthlyPeriods } from './compareMonthlyPeriods';
import type { Movement } from '../domain/models/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm', user_id: 'u1', type: 'EXPENSE', amount: 0, date: new Date(),
    is_recurring: false, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  } as Movement;
}

describe('compareMonthlyPeriods', () => {
  it('computes income, expense and balance for both periods with their delta when the previous period has data', () => {
    const current = [
      movement({ type: 'INCOME', amount: 5000 }),
      movement({ type: 'EXPENSE', amount: 2000 }),
    ];
    const previous = [
      movement({ type: 'INCOME', amount: 4000 }),
      movement({ type: 'EXPENSE', amount: 3000 }),
    ];

    const result = compareMonthlyPeriods(current, previous);

    expect(result.current).toEqual({ income: 5000, expense: 2000, balance: 3000 });
    expect(result.previous).toEqual({ income: 4000, expense: 3000, balance: 1000 });
    expect(result.delta).toEqual({ income: 1000, expense: -1000, balance: 2000 });
  });

  it('returns previous and delta as null when there is no data for the previous period (spec.md Edge Cases)', () => {
    const current = [movement({ type: 'INCOME', amount: 1000 })];

    const result = compareMonthlyPeriods(current, []);

    expect(result.previous).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.current).toEqual({ income: 1000, expense: 0, balance: 1000 });
  });

  it('handles mixed income/expense movements correctly in both periods', () => {
    const current = [
      movement({ type: 'INCOME', amount: 10000 }),
      movement({ type: 'EXPENSE', amount: 4000 }),
      movement({ type: 'EXPENSE', amount: 1000 }),
    ];
    const previous = [
      movement({ type: 'INCOME', amount: 8000 }),
      movement({ type: 'EXPENSE', amount: 2000 }),
    ];

    const result = compareMonthlyPeriods(current, previous);

    expect(result.current).toEqual({ income: 10000, expense: 5000, balance: 5000 });
    expect(result.previous).toEqual({ income: 8000, expense: 2000, balance: 6000 });
    expect(result.delta).toEqual({ income: 2000, expense: 3000, balance: -1000 });
  });

  it('never counts a TRANSFER as income or expense in either period', () => {
    const transfer = movement({ type: 'TRANSFER', amount: 9999, account_id: 'a', to_account_id: 'b' });
    const result = compareMonthlyPeriods(
      [movement({ type: 'INCOME', amount: 5000 }), transfer],
      [movement({ type: 'EXPENSE', amount: 1000 }), transfer],
    );
    expect(result.current).toEqual({ income: 5000, expense: 0, balance: 5000 });
    expect(result.previous).toEqual({ income: 0, expense: 1000, balance: -1000 });
  });
});
