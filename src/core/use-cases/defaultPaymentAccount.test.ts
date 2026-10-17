import { describe, it, expect } from 'vitest';
import { buildDefaultCashAccount, defaultCashAccountId } from './defaultPaymentAccount';

describe('buildDefaultCashAccount', () => {
  const now = new Date(2026, 9, 16, 10);

  it('builds the "Efectivo" cash account with a zero opening balance', () => {
    const account = buildDefaultCashAccount('user-1', now);
    expect(account).toMatchObject({
      user_id: 'user-1', name: 'Efectivo', kind: 'cash', opening_balance: 0, created_at: now, updated_at: now,
    });
  });

  it('uses a stable id per user (same user -> same id, different user -> different id)', () => {
    expect(buildDefaultCashAccount('user-1', now).id).toBe(defaultCashAccountId('user-1'));
    expect(defaultCashAccountId('user-1')).toBe(defaultCashAccountId('user-1'));
    expect(defaultCashAccountId('user-1')).not.toBe(defaultCashAccountId('user-2'));
  });
});
