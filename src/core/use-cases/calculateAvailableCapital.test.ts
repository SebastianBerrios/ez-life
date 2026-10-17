import { describe, expect, it } from 'vitest';
import { calculateAvailableCapital } from './calculateAvailableCapital';
import type { Movement, PaymentAccount } from '../domain/models/types';

const now = new Date(2026, 9, 10);
const account = (id: string, opening: number, extra: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id, user_id: 'u', name: id, kind: 'debit', opening_balance: opening, created_at: now, updated_at: now, ...extra,
});
const move = (o: Partial<Movement>): Movement => ({
  id: `m-${Math.random()}`, user_id: 'u', type: 'EXPENSE', amount: 0, date: now, is_recurring: false, created_at: now, updated_at: now, ...o,
});

describe('calculateAvailableCapital', () => {
  it('sums opening balances plus income minus expense across accounts', () => {
    const total = calculateAvailableCapital(
      [account('a', 10000), account('b', -2000)],
      [move({ type: 'INCOME', amount: 5000, account_id: 'a' }), move({ type: 'EXPENSE', amount: 1500, account_id: 'b' })],
    );
    expect(total).toBe(10000 - 2000 + 5000 - 1500);
  });

  it('a transfer between own accounts does not change the total', () => {
    const accounts = [account('a', 10000), account('b', 0)];
    const before = calculateAvailableCapital(accounts, []);
    const after = calculateAvailableCapital(accounts, [move({ type: 'TRANSFER', amount: 3000, account_id: 'a', to_account_id: 'b' })]);
    expect(after).toBe(before);
  });

  it('includes movements without an account (legacy rows) and ignores soft-deleted ones', () => {
    const total = calculateAvailableCapital(
      [account('a', 1000)],
      [move({ type: 'INCOME', amount: 700 }), move({ type: 'EXPENSE', amount: 200, deleted_at: now }), move({ type: 'EXPENSE', amount: 100 })],
    );
    expect(total).toBe(1000 + 700 - 100);
  });

  it('counts archived accounts by default and can exclude them', () => {
    const accounts = [account('a', 1000), account('old', 500, { archived: true })];
    expect(calculateAvailableCapital(accounts, [])).toBe(1500);
    expect(calculateAvailableCapital(accounts, [], { includeArchived: false })).toBe(1000);
  });

  it('returns 0 with no accounts and no movements', () => {
    expect(calculateAvailableCapital([], [])).toBe(0);
  });
});
