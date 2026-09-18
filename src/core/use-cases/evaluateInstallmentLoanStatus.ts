import { InstallmentLoanStatus } from '../domain/models/types';

/**
 * Derives an InstallmentLoan's status from its remaining installments.
 * Never reverts 'settled' back to 'active' (FR-025) — same one-way
 * transition Debt already has via its own settled_amount check.
 */
export function evaluateInstallmentLoanStatus(remainingInstallments: number, currentStatus: InstallmentLoanStatus): InstallmentLoanStatus {
  if (currentStatus === 'settled') {
    return 'settled';
  }
  return remainingInstallments <= 0 ? 'settled' : 'active';
}
