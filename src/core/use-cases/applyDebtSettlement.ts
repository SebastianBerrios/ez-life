import { DomainError } from '../domain/errors/DomainError';

export interface DebtSettlementResult {
  settled_amount: number;
  is_fully_settled: boolean;
}

/**
 * Applies a partial or full repayment to a debt's running settled total.
 * Deliberately returns nothing resembling a Movement — settling a debt is
 * bookkeeping only (constitution Principle X / FR-004); the caller must
 * never turn this result into an income/expense entry.
 */
export function applyDebtSettlement(
  debt: { amount: number; settled_amount: number },
  paymentAmount: number
): DebtSettlementResult {
  if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) {
    throw new DomainError('El monto de la devolución debe ser un entero mayor a 0.');
  }

  const remaining = debt.amount - debt.settled_amount;
  if (paymentAmount > remaining) {
    throw new DomainError('El monto de la devolución no puede superar el saldo pendiente.');
  }

  const settled_amount = debt.settled_amount + paymentAmount;
  return {
    settled_amount,
    is_fully_settled: settled_amount >= debt.amount,
  };
}
