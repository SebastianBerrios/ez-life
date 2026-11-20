import { describe, it, expect } from 'vitest';
import { pickPrimaryAccount } from './pickPrimaryAccount';
import type { PaymentAccount } from '../domain/models/types';

const acc = (
  id: string,
  kind: PaymentAccount['kind'],
  createdAt: Date,
  extra: Partial<PaymentAccount> = {},
): PaymentAccount => ({
  id,
  user_id: 'u1',
  name: id,
  kind,
  opening_balance: 0,
  created_at: createdAt,
  updated_at: createdAt,
  ...extra,
});

describe('pickPrimaryAccount', () => {
  it('picks the oldest active debit account, tie-breaking deterministically by id', () => {
    const t1 = new Date('2026-01-01T10:00:00Z');
    const t2 = new Date('2026-02-01T10:00:00Z');
    const accounts = [
      acc('cash', 'cash', new Date('2025-12-01T00:00:00Z')),
      acc('debit-b', 'debit', t1),
      acc('debit-a', 'debit', t1),
      acc('debit-newer', 'debit', t2),
    ];
    expect(pickPrimaryAccount(accounts, 'u1')?.id).toBe('debit-a');
  });

  it('skips archived and deleted debit accounts and falls back to active cash', () => {
    const t = new Date('2026-01-01T10:00:00Z');
    const accounts = [
      acc('debit-archived', 'debit', t, { archived: true }),
      acc('debit-deleted', 'debit', t, { deleted_at: t }),
      acc('savings', 'savings', t),
      acc('credit', 'credit', t),
      acc('cash-1', 'cash', t, { name: 'Efectivo' }),
    ];
    expect(pickPrimaryAccount(accounts, 'u1')?.id).toBe('cash-1');
  });

  it('ignores accounts belonging to other users and returns undefined when no debit or cash is active', () => {
    const t = new Date('2026-01-01T10:00:00Z');
    const accounts = [
      acc('other-debit', 'debit', t, { user_id: 'u2' }),
      acc('savings', 'savings', t),
      acc('cash-archived', 'cash', t, { archived: true }),
    ];
    expect(pickPrimaryAccount(accounts, 'u1')).toBeUndefined();
  });
});
