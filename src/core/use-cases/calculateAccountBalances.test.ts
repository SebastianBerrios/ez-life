import { describe, it, expect } from 'vitest';
import { calculateAccountBalances, calculateTotalBalance, calculateUnassignedBalance } from './calculateAccountBalances';
import type { Movement, PaymentAccount } from '../domain/models/types';

const d = new Date(2026, 9, 1);
const account = (id: string, opening_balance: number, extra: Partial<PaymentAccount> = {}): PaymentAccount =>
  ({ id, user_id: 'u', name: id, kind: 'debit', opening_balance, created_at: d, updated_at: d, ...extra });
const movement = (type: Movement['type'], amount: number, extra: Partial<Movement> = {}): Movement =>
  ({ id: `${type}-${amount}-${Math.random()}`, user_id: 'u', type, amount, date: d, is_recurring: false, created_at: d, updated_at: d, ...extra });

describe('calculateAccountBalances', () => {
  it('starts from the opening balance when there are no movements', () => {
    const balances = calculateAccountBalances([account('a', 5000), account('b', -2000)], []);
    expect(balances).toEqual({ a: 5000, b: -2000 });
  });

  it('adds income and subtracts expenses on the account they are tied to', () => {
    const balances = calculateAccountBalances([account('a', 1000), account('b', 0)], [
      movement('INCOME', 3000, { account_id: 'a' }),
      movement('EXPENSE', 500, { account_id: 'a' }),
      movement('EXPENSE', 200, { account_id: 'b' }),
    ]);
    expect(balances).toEqual({ a: 3500, b: -200 });
  });

  it('moves money between accounts on a transfer without changing the total', () => {
    const accounts = [account('a', 10000), account('b', 0)];
    const balances = calculateAccountBalances(accounts, [movement('TRANSFER', 4000, { account_id: 'a', to_account_id: 'b' })]);
    expect(balances).toEqual({ a: 6000, b: 4000 });
    expect(calculateTotalBalance(accounts, balances)).toBe(10000);
  });

  it('counts balance adjustments (income and expense) toward the account balance', () => {
    const balances = calculateAccountBalances([account('a', 0)], [
      movement('INCOME', 700, { account_id: 'a', is_adjustment: true, description: 'x' }),
      movement('EXPENSE', 300, { account_id: 'a', is_adjustment: true, description: 'y' }),
    ]);
    expect(balances.a).toBe(400);
  });

  it('ignores deleted movements and reports movements without account as unassigned', () => {
    const movements = [
      movement('INCOME', 900, { account_id: 'a', deleted_at: d }),
      movement('INCOME', 1000),
      movement('EXPENSE', 400),
      movement('TRANSFER', 50, { account_id: 'a' }),
    ];
    expect(calculateAccountBalances([account('a', 0)], movements)).toEqual({ a: -50 });
    expect(calculateUnassignedBalance(movements)).toBe(600);
  });

  it('ignores movements pointing to unknown accounts and skips deleted accounts', () => {
    const balances = calculateAccountBalances([account('a', 100), account('z', 9, { deleted_at: d })], [
      movement('INCOME', 50, { account_id: 'ghost' }),
    ]);
    expect(balances).toEqual({ a: 100 });
  });

  it('total excludes archived accounts only when asked', () => {
    const accounts = [account('a', 100), account('b', 50, { archived: true })];
    const balances = calculateAccountBalances(accounts, []);
    expect(calculateTotalBalance(accounts, balances)).toBe(150);
    expect(calculateTotalBalance(accounts, balances, { includeArchived: false })).toBe(100);
  });
});
