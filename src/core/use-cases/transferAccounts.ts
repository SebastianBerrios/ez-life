import type { PaymentAccount, UUID } from '../domain/models/types';
import { defaultCashAccountId } from './defaultPaymentAccount';

export interface TransferPair {
  fromId: UUID;
  toId: UUID;
}

/** Non-archived, non-deleted accounts (an account being edited can be kept via `keepId`). */
export function usableAccounts(accounts: PaymentAccount[], keepId?: UUID): PaymentAccount[] {
  return accounts.filter(a => !a.deleted_at && (!a.archived || a.id === keepId));
}

/** A transfer needs two different accounts to move money between. */
export function canTransfer(accounts: PaymentAccount[]): boolean {
  return usableAccounts(accounts).length >= 2;
}

/** Origin: the user's Efectivo account when present, else the first one. Destination: the next different one. */
export function defaultTransferPair(accounts: PaymentAccount[], userId: UUID): TransferPair | null {
  const usable = usableAccounts(accounts);
  if (usable.length < 2) return null;
  const from = usable.find(a => a.id === defaultCashAccountId(userId)) ?? usable[0];
  const to = usable.find(a => a.id !== from.id);
  return to ? { fromId: from.id, toId: to.id } : null;
}

export function swapTransferPair(pair: TransferPair): TransferPair {
  return { fromId: pair.toId, toId: pair.fromId };
}

/**
 * Picks an account for one side. Choosing the account already used by the other side swaps them,
 * so the pair can never end up with the same account on both sides.
 */
export function selectTransferAccount(pair: TransferPair, side: 'from' | 'to', accountId: UUID): TransferPair {
  if (side === 'from') {
    return accountId === pair.toId ? swapTransferPair(pair) : { ...pair, fromId: accountId };
  }
  return accountId === pair.fromId ? swapTransferPair(pair) : { ...pair, toId: accountId };
}

/** An account can be archived while at least one other usable account remains. */
export function canArchiveAccount(accounts: PaymentAccount[], accountId: UUID): boolean {
  const usable = usableAccounts(accounts);
  return usable.some(a => a.id === accountId) && usable.length > 1;
}
