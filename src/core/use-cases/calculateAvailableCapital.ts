import type { Movement, PaymentAccount } from '../domain/models/types';
import { calculateAccountBalances, calculateTotalBalance, calculateUnassignedBalance } from './calculateAccountBalances';

/**
 * "Capital disponible": the sum of every payment account's balance plus the net of movements that
 * are not attributed to any account (legacy rows created before spec 011). Transfers between own
 * accounts net to zero. Composes the spec 011 helpers instead of duplicating their math.
 *
 * `movements` must be the user's FULL history: balances are opening balance + every movement ever.
 * (`calculateTotalBalance` in `calculateAccountBalances.ts` takes precomputed balances and ignores
 * unassigned movements, hence this separate entry point.)
 */
export function calculateAvailableCapital(
  accounts: PaymentAccount[],
  movements: Movement[],
  options: { includeArchived?: boolean } = {},
): number {
  const balances = calculateAccountBalances(accounts, movements);
  return calculateTotalBalance(accounts, balances, options) + calculateUnassignedBalance(movements);
}
