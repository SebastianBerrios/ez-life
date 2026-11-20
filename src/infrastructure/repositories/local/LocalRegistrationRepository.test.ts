import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalRegistrationRepository } from './LocalRegistrationRepository';

describe('LocalRegistrationRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('skips an item idempotently with deterministic id, unskips via soft delete, and scopes skips to their month', async () => {
    const repo = new LocalRegistrationRepository();
    const userId = 'u1';
    const keyNov = 'recurrence:r1:2026-11';

    const first = await repo.skip(userId, keyNov);
    const second = await repo.skip(userId, keyNov);
    expect(second.id).toBe(first.id);
    expect(await db.reminder_skips.count()).toBe(1);

    // Queued for sync automatically via db hooks
    expect((await db.sync_queue.toArray()).some(q => q.table_name === 'reminder_skips')).toBe(true);

    const inputsNov = await repo.getInputs(userId, new Date(2026, 10, 15));
    expect(inputsNov.skips).toHaveLength(1);

    // Next month is unaffected by November skip
    const inputsDec = await repo.getInputs(userId, new Date(2026, 11, 15));
    expect(inputsDec.skips).toHaveLength(0);

    // Unskip revives the item (soft delete)
    await repo.unskip(userId, keyNov);
    const raw = await db.reminder_skips.get(first.id);
    expect(raw?.deleted_at).toBeInstanceOf(Date);
    expect((await repo.getInputs(userId, new Date(2026, 10, 15))).skips).toHaveLength(0);
  });

  it('returns rules, incomeSources, loans, loanIdByPaymentId, accounts and monthMovements in one call', async () => {
    const repo = new LocalRegistrationRepository();
    const userId = 'u1';
    const nov = new Date(2026, 10, 10, 12, 0);
    const oct = new Date(2026, 9, 10, 12, 0);

    await db.installment_loans.put({
      id: 'l1', user_id: userId, lender_name: 'BCP', amount: 120000, installment_count: 12,
      remaining_installments: 6, installment_amount: 10000, payment_day: 10, status: 'active',
      created_at: oct, updated_at: oct,
    });
    await db.installment_payments.put({
      id: 'p1', installment_loan_id: 'l1', kind: 'installment', amount: 10000, date: nov,
      created_at: nov, updated_at: nov,
    });
    await db.movements.put({
      id: 'm-nov', user_id: userId, type: 'EXPENSE', amount: 10000, date: nov,
      installment_payment_id: 'p1', is_recurring: false, created_at: nov, updated_at: nov,
    });
    await db.movements.put({
      id: 'm-oct', user_id: userId, type: 'EXPENSE', amount: 10000, date: oct,
      is_recurring: false, created_at: oct, updated_at: oct,
    });

    const inputs = await repo.getInputs(userId, nov);
    expect(inputs.loans).toHaveLength(1);
    expect(inputs.loanIdByPaymentId).toEqual({ p1: 'l1' });
    expect(inputs.monthMovements.map(m => m.id)).toEqual(['m-nov']);
  });
});
