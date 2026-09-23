import { DomainError } from '../domain/errors/DomainError';
import { InstallmentLoanStatus, UUID } from '../domain/models/types';
import { evaluateInstallmentLoanStatus } from './evaluateInstallmentLoanStatus';

export interface InstallmentPaymentRecordResult {
  remaining_installments: number;
  status: InstallmentLoanStatus;
  payment: { kind: 'installment'; amount: number; date: Date };
  /**
   * Description of the expense Movement this payment must generate
   * (constitution v2.0.0 Principio X, spec 003 FR-010) — amount/date mirror
   * `payment`, `distribution_category_id` is copied verbatim from the loan.
   * The caller (repository) is responsible for actually persisting it.
   */
  movement: { amount: number; date: Date; distribution_category_id?: UUID };
}

/**
 * Applies N regular installment payments to a loan's running count and
 * describes the resulting bookkeeping entry AND the expense Movement it must
 * generate (constitution v2.0.0 Principio X — unlike applyDebtSettlement,
 * an InstallmentPayment is real money leaving the user's pocket). Still a
 * pure function: it never touches a repository or creates anything itself.
 */
export function recordInstallmentPayment(
  loan: { installment_amount: number; remaining_installments: number; distribution_category_id?: UUID },
  installmentsPaid: number,
  date: Date
): InstallmentPaymentRecordResult {
  if (!Number.isInteger(installmentsPaid) || installmentsPaid <= 0) {
    throw new DomainError('El número de cuotas a pagar debe ser un entero mayor a 0.');
  }

  if (installmentsPaid > loan.remaining_installments) {
    throw new DomainError('No podés pagar más cuotas de las que quedan pendientes.');
  }

  const remaining_installments = loan.remaining_installments - installmentsPaid;
  const amount = loan.installment_amount * installmentsPaid;

  return {
    remaining_installments,
    status: evaluateInstallmentLoanStatus(remaining_installments, 'active'),
    payment: {
      kind: 'installment',
      amount,
      date,
    },
    movement: {
      amount,
      date,
      distribution_category_id: loan.distribution_category_id,
    },
  };
}
