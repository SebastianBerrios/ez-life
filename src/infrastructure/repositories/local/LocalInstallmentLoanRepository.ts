import { db } from '../../db/db';
import { IInstallmentLoanRepository, PrincipalPaymentAdjustment } from '../../../core/domain/repositories/IRepositories';
import { InstallmentLoan, InstallmentPayment, UUID } from '../../../core/domain/models/types';
import { DomainError } from '../../../core/domain/errors/DomainError';
import { uuidv7 } from 'uuidv7';
import { recordInstallmentPayment } from '../../../core/use-cases/recordInstallmentPayment';
import { recordPrincipalPayment } from '../../../core/use-cases/recordPrincipalPayment';

export class LocalInstallmentLoanRepository implements IInstallmentLoanRepository {
  async getAll(userId: UUID): Promise<InstallmentLoan[]> {
    return await db.installment_loans.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async getById(id: UUID): Promise<InstallmentLoan | undefined> {
    const loan = await db.installment_loans.get(id);
    return loan && !loan.deleted_at ? loan : undefined;
  }

  async create(
    data: Omit<InstallmentLoan, 'created_at' | 'updated_at' | 'remaining_installments' | 'status'>,
    alreadyPaid = 0,
  ): Promise<void> {
    if (!Number.isSafeInteger(alreadyPaid) || alreadyPaid < 0) {
      throw new DomainError('Las cuotas pagadas no pueden ser negativas.');
    }
    if (alreadyPaid > data.installment_count) {
      throw new DomainError('Las cuotas pagadas no pueden superar las cuotas totales.');
    }
    if (data.payment_day !== undefined && (!Number.isSafeInteger(data.payment_day) || data.payment_day < 1 || data.payment_day > 31)) {
      throw new DomainError('Ingresa un día entre 1 y 31.');
    }

    const now = new Date();
    const id = data.id || uuidv7();
    const remaining = data.installment_count - alreadyPaid;
    const loan: InstallmentLoan = {
      ...data,
      id,
      remaining_installments: remaining,
      status: remaining === 0 ? 'settled' : 'active',
      created_at: now,
      updated_at: now,
    };
    await db.installment_loans.put(loan);
  }

  async updateTerms(
    id: UUID,
    changes: {
      amount?: number;
      installmentCount?: number;
      installmentAmount?: number;
      interestRate?: number;
      distributionCategoryId?: UUID;
      paymentDay?: number;
    },
  ): Promise<void> {
    const existing = await db.installment_loans.get(id);
    if (!existing) {
      throw new Error(`InstallmentLoan ${id} not found`);
    }

    const updated: InstallmentLoan = {
      ...existing,
      amount: changes.amount ?? existing.amount,
      installment_count: changes.installmentCount ?? existing.installment_count,
      installment_amount: changes.installmentAmount ?? existing.installment_amount,
      interest_rate: changes.interestRate ?? existing.interest_rate,
      distribution_category_id: changes.distributionCategoryId ?? existing.distribution_category_id,
      payment_day: changes.paymentDay !== undefined ? changes.paymentDay : existing.payment_day,
      updated_at: new Date(),
    };
    await db.installment_loans.put(updated);
  }

  async recordInstallmentPayment(loanId: UUID, installmentsPaid: number, date: Date, accountId?: UUID): Promise<void> {
    const existing = await db.installment_loans.get(loanId);
    if (!existing) {
      throw new Error(`InstallmentLoan ${loanId} not found`);
    }

    const result = recordInstallmentPayment(existing, installmentsPaid, date);
    const now = new Date();
    const paymentId = uuidv7();

    // Same Dexie transaction: bookkeeping (loan + payment log) AND the
    // expense Movement this payment generates (constitution v2.0.0
    // Principio X, spec 003 FR-010/FR-011, spec 013 FR-020) are all-or-nothing.
    await db.transaction('rw', db.installment_loans, db.installment_payments, db.movements, db.sync_queue, async () => {
      await db.installment_loans.put({
        ...existing,
        remaining_installments: result.remaining_installments,
        status: result.status,
        updated_at: now,
      });

      await db.installment_payments.put({
        id: paymentId,
        installment_loan_id: loanId,
        kind: result.payment.kind,
        amount: result.payment.amount,
        date: result.payment.date,
        created_at: now,
        updated_at: now,
      });

      await db.movements.put({
        id: uuidv7(),
        user_id: existing.user_id,
        type: 'EXPENSE',
        amount: result.movement.amount,
        date: result.movement.date,
        description: `Cuota — ${existing.lender_name}`,
        distribution_category_id: result.movement.distribution_category_id,
        ...(accountId ? { account_id: accountId } : {}),
        is_recurring: false,
        installment_payment_id: paymentId,
        created_at: now,
        updated_at: now,
      });
    });
  }

  async recordPrincipalPayment(
    loanId: UUID,
    amountCents: number,
    date: Date,
    adjustment: PrincipalPaymentAdjustment,
    accountId?: UUID,
  ): Promise<void> {
    const existing = await db.installment_loans.get(loanId);
    if (!existing) {
      throw new Error(`InstallmentLoan ${loanId} not found`);
    }

    const result = recordPrincipalPayment(existing, amountCents, date, adjustment);
    const now = new Date();
    const paymentId = uuidv7();

    await db.transaction('rw', db.installment_loans, db.installment_payments, db.movements, db.sync_queue, async () => {
      await db.installment_loans.put({
        ...existing,
        remaining_installments: result.remaining_installments,
        installment_amount: result.installment_amount,
        status: result.status,
        updated_at: now,
      });

      const payment: InstallmentPayment = {
        id: paymentId,
        installment_loan_id: loanId,
        kind: result.payment.kind,
        amount: result.payment.amount,
        date: result.payment.date,
        adjustment_type: result.payment.adjustment_type,
        resulting_value: result.payment.resulting_value,
        created_at: now,
        updated_at: now,
      };
      await db.installment_payments.put(payment);

      await db.movements.put({
        id: uuidv7(),
        user_id: existing.user_id,
        type: 'EXPENSE',
        amount: result.movement.amount,
        date: result.movement.date,
        description: `Abono a capital — ${existing.lender_name}`,
        distribution_category_id: result.movement.distribution_category_id,
        ...(accountId ? { account_id: accountId } : {}),
        is_recurring: false,
        installment_payment_id: paymentId,
        created_at: now,
        updated_at: now,
      });
    });
  }

  async getPayments(loanId: UUID): Promise<InstallmentPayment[]> {
    return await db.installment_payments.where('installment_loan_id').equals(loanId).sortBy('date');
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.installment_loans.get(id);
    if (existing) {
      await db.installment_loans.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
