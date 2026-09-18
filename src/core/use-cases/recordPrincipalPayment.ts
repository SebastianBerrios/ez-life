import { DomainError } from '../domain/errors/DomainError';
import { InstallmentAdjustmentType, InstallmentLoanStatus } from '../domain/models/types';
import { evaluateInstallmentLoanStatus } from './evaluateInstallmentLoanStatus';
import { PrincipalPaymentAdjustment } from '../domain/repositories/IRepositories';

export interface PrincipalPaymentRecordResult {
  remaining_installments: number;
  installment_amount: number;
  status: InstallmentLoanStatus;
  payment: {
    kind: 'principal';
    amount: number;
    date: Date;
    adjustment_type: InstallmentAdjustmentType;
    resulting_value: number;
  };
}

/**
 * Applies a principal/advance payment against a loan. The resulting new
 * value (fewer remaining installments, or a lower installment amount) is
 * always the value the user typed in themselves — this function only
 * validates and applies it, it never derives it (FR-017). Deliberately
 * returns nothing resembling a Movement (Principio X / FR-027), same
 * guarantee applyDebtSettlement already gives for Debt.
 */
export function recordPrincipalPayment(
  loan: { installment_amount: number; remaining_installments: number },
  amountCents: number,
  date: Date,
  adjustment: PrincipalPaymentAdjustment
): PrincipalPaymentRecordResult {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new DomainError('El monto del abono debe ser un entero mayor a 0.');
  }

  const outstandingBalance = loan.installment_amount * loan.remaining_installments;
  if (amountCents > outstandingBalance) {
    throw new DomainError('El abono no puede superar el saldo pendiente.');
  }

  let remaining_installments = loan.remaining_installments;
  let installment_amount = loan.installment_amount;
  let resulting_value: number;

  if (adjustment.type === 'reduce_term') {
    const newValue = adjustment.newRemainingInstallments;
    if (!Number.isInteger(newValue) || newValue < 0 || newValue > loan.remaining_installments) {
      throw new DomainError('El nuevo número de cuotas restantes no es válido.');
    }
    remaining_installments = newValue;
    resulting_value = newValue;
  } else {
    const newValue = adjustment.newInstallmentAmountCents;
    if (!Number.isInteger(newValue) || newValue <= 0) {
      throw new DomainError('El nuevo monto de cuota no es válido.');
    }
    installment_amount = newValue;
    resulting_value = newValue;
  }

  return {
    remaining_installments,
    installment_amount,
    status: evaluateInstallmentLoanStatus(remaining_installments, 'active'),
    payment: {
      kind: 'principal',
      amount: amountCents,
      date,
      adjustment_type: adjustment.type,
      resulting_value,
    },
  };
}
