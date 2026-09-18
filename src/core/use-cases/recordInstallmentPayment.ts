import { DomainError } from '../domain/errors/DomainError';
import { InstallmentLoanStatus } from '../domain/models/types';
import { evaluateInstallmentLoanStatus } from './evaluateInstallmentLoanStatus';

export interface InstallmentPaymentRecordResult {
  remaining_installments: number;
  status: InstallmentLoanStatus;
  payment: { kind: 'installment'; amount: number; date: Date };
}

/**
 * Applies N regular installment payments to a loan's running count.
 * Deliberately returns nothing resembling a Movement — recording an
 * installment payment is bookkeeping only (constitution Principio X /
 * FR-027), same guarantee applyDebtSettlement already gives for Debt. The
 * caller must never turn this result into an income/expense entry.
 */
export function recordInstallmentPayment(
  loan: { installment_amount: number; remaining_installments: number },
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

  return {
    remaining_installments,
    status: evaluateInstallmentLoanStatus(remaining_installments, 'active'),
    payment: {
      kind: 'installment',
      amount: loan.installment_amount * installmentsPaid,
      date,
    },
  };
}
