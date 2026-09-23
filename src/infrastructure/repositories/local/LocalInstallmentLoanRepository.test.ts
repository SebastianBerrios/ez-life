import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalInstallmentLoanRepository } from './LocalInstallmentLoanRepository';
import { uuidv7 } from 'uuidv7';
import { DomainError } from '../../../core/domain/errors/DomainError';
import type { InstallmentLoan } from '../../../core/domain/models/types';

describe('LocalInstallmentLoanRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  const baseLoan = (userId: string): Omit<InstallmentLoan, 'created_at' | 'updated_at' | 'remaining_installments' | 'status'> => ({
    id: '',
    user_id: userId,
    lender_name: 'BCP',
    amount: 200000,
    installment_count: 12,
    installment_amount: 20000,
    interest_rate: 15,
    distribution_category_id: 'bucket-1',
  });

  it('create() initializes remaining_installments = installment_count and status = active (FR-011)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();

    await repo.create(baseLoan(userId));

    const [loan] = await repo.getAll(userId);
    expect(loan.remaining_installments).toBe(12);
    expect(loan.status).toBe('active');
    expect(loan.amount).toBe(200000);
  });

  it('recordInstallmentPayment() delegates validation to the use-case, without reimplementing it (Principio III)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordInstallmentPayment(loan.id, 2, new Date('2026-09-18'));

    const [updated] = await repo.getAll(userId);
    expect(updated.remaining_installments).toBe(10);

    const payments = await repo.getPayments(loan.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ kind: 'installment', amount: 40000 });

    await expect(repo.recordInstallmentPayment(loan.id, 999, new Date())).rejects.toThrow(DomainError);
  });

  it('recordInstallmentPayment() also creates a Movement of type EXPENSE, linked via installment_payment_id, using the loan\'s distribution_category_id (FR-008, FR-010, constitution v2.0.0 Principio X)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordInstallmentPayment(loan.id, 2, new Date('2026-09-18'));

    const payments = await repo.getPayments(loan.id);
    expect(payments).toHaveLength(1);

    const movements = (await db.movements.toArray()).filter(m => !m.deleted_at);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: 'EXPENSE',
      amount: 40000,
      user_id: userId,
      installment_payment_id: payments[0].id,
      distribution_category_id: 'bucket-1',
    });
  });

  it('recordPrincipalPayment() applies the adjustment and logs it, delegating validation to the use-case', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordPrincipalPayment(loan.id, 100000, new Date('2026-09-18'), { type: 'reduce_term', newRemainingInstallments: 7 });

    const [updated] = await repo.getAll(userId);
    expect(updated.remaining_installments).toBe(7);
    expect(updated.installment_amount).toBe(20000); // unchanged

    const payments = await repo.getPayments(loan.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ kind: 'principal', adjustment_type: 'reduce_term', resulting_value: 7 });
  });

  it('recordPrincipalPayment() creates a linked Movement for adjustment.type = reduce_term (FR-009, FR-010)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordPrincipalPayment(loan.id, 100000, new Date('2026-09-18'), { type: 'reduce_term', newRemainingInstallments: 7 });

    const [updated] = await repo.getAll(userId);
    expect(updated.remaining_installments).toBe(7); // FR-009: reduce_term DOES change remaining_installments

    const payments = await repo.getPayments(loan.id);
    const movements = (await db.movements.toArray()).filter(m => !m.deleted_at);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: 'EXPENSE',
      amount: 100000,
      installment_payment_id: payments[0].id,
      distribution_category_id: 'bucket-1',
    });
  });

  it('recordPrincipalPayment() creates a linked Movement for adjustment.type = reduce_installment_amount, WITHOUT changing remaining_installments (FR-009 gap covered — research.md §4)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordPrincipalPayment(loan.id, 50000, new Date('2026-09-18'), { type: 'reduce_installment_amount', newInstallmentAmountCents: 15000 });

    const [updated] = await repo.getAll(userId);
    expect(updated.remaining_installments).toBe(12); // FR-009: unchanged for reduce_installment_amount
    expect(updated.installment_amount).toBe(15000);

    const payments = await repo.getPayments(loan.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ kind: 'principal', adjustment_type: 'reduce_installment_amount', resulting_value: 15000 });

    const movements = (await db.movements.toArray()).filter(m => !m.deleted_at);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: 'EXPENSE',
      amount: 50000,
      installment_payment_id: payments[0].id,
      distribution_category_id: 'bucket-1',
    });
  });

  it('marks the loan settled once remaining_installments reaches 0, and keeps it visible (FR-025)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.recordInstallmentPayment(loan.id, 12, new Date());

    const [updated] = await repo.getAll(userId);
    expect(updated.status).toBe('settled');
    expect(updated.remaining_installments).toBe(0);
  });

  it('updateTerms() corrects original terms independently of any payment, without touching status', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.updateTerms(loan.id, { amount: 250000, installmentAmount: 25000 });

    const [updated] = await repo.getAll(userId);
    expect(updated.amount).toBe(250000);
    expect(updated.installment_amount).toBe(25000);
    expect(updated.installment_count).toBe(12); // untouched field stays as-is
    expect(updated.status).toBe('active');
  });

  it('delete() soft-deletes — the row no longer appears in getAll()', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));
    const [loan] = await repo.getAll(userId);

    await repo.delete(loan.id);

    expect(await repo.getAll(userId)).toHaveLength(0);
  });

  it('writes to the shared sync_queue on create (FR — offline-first sync, same middleware as every synced table)', async () => {
    const repo = new LocalInstallmentLoanRepository();
    const userId = uuidv7();
    await repo.create(baseLoan(userId));

    const queued = (await db.sync_queue.toArray()).filter(q => q.table_name === 'installment_loans');
    expect(queued.length).toBeGreaterThan(0);
  });
});
