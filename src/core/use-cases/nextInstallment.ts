import type { InstallmentLoan } from '../domain/models/types';

export interface NextInstallment {
  /** 1-based number of the next installment to pay. */
  number: number;
  total: number;
  amountCents: number;
  remaining: number;
}

/**
 * Next unpaid installment of an active loan, from the user-entered fields only. There is no due date
 * (the model has none and the app never builds an amortization table), so none is derived.
 */
export function nextInstallment(loan: InstallmentLoan): NextInstallment | null {
  if (loan.deleted_at || loan.status !== 'active' || loan.remaining_installments <= 0) return null;
  const paid = Math.max(0, loan.installment_count - loan.remaining_installments);
  return {
    number: Math.min(paid + 1, loan.installment_count),
    total: loan.installment_count,
    amountCents: loan.installment_amount,
    remaining: loan.remaining_installments,
  };
}
