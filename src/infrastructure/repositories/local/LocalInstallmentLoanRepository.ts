import { db } from '../../db/db';
import { IInstallmentLoanRepository, PrincipalPaymentAdjustment } from '../../../core/domain/repositories/IRepositories';
import { InstallmentLoan, InstallmentPayment, UUID } from '../../../core/domain/models/types';
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

  async create(data: Omit<InstallmentLoan, 'created_at' | 'updated_at' | 'remaining_installments' | 'status'>): Promise<void> {
    const now = new Date();
    const id = data.id || uuidv7();
    const loan: InstallmentLoan = {
      ...data,
      id,
      remaining_installments: data.installment_count,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    await db.installment_loans.put(loan);
  }

  async updateTerms(id: UUID, changes: { amount?: number; installmentCount?: number; installmentAmount?: number; interestRate?: number }): Promise<void> {
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
      updated_at: new Date(),
    };
    await db.installment_loans.put(updated);
  }

  async recordInstallmentPayment(loanId: UUID, installmentsPaid: number, date: Date): Promise<void> {
    const existing = await db.installment_loans.get(loanId);
    if (!existing) {
      throw new Error(`InstallmentLoan ${loanId} not found`);
    }

    const result = recordInstallmentPayment(existing, installmentsPaid, date);
    const now = new Date();

    await db.installment_loans.put({
      ...existing,
      remaining_installments: result.remaining_installments,
      status: result.status,
      updated_at: now,
    });

    await db.installment_payments.put({
      id: uuidv7(),
      installment_loan_id: loanId,
      kind: result.payment.kind,
      amount: result.payment.amount,
      date: result.payment.date,
      created_at: now,
      updated_at: now,
    });
  }

  async recordPrincipalPayment(loanId: UUID, amountCents: number, date: Date, adjustment: PrincipalPaymentAdjustment): Promise<void> {
    const existing = await db.installment_loans.get(loanId);
    if (!existing) {
      throw new Error(`InstallmentLoan ${loanId} not found`);
    }

    const result = recordPrincipalPayment(existing, amountCents, date, adjustment);
    const now = new Date();

    await db.installment_loans.put({
      ...existing,
      remaining_installments: result.remaining_installments,
      installment_amount: result.installment_amount,
      status: result.status,
      updated_at: now,
    });

    const payment: InstallmentPayment = {
      id: uuidv7(),
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
