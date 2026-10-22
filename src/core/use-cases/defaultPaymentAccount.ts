import type { PaymentAccount, UUID } from '../domain/models/types';
import { stableId } from './stableId';

/** Stable per-user id so every device seeds the very same row (sync converges, never duplicates). */
export function defaultCashAccountId(userId: UUID): UUID {
  return stableId(`seed-account:${userId}:efectivo`);
}

export function buildDefaultCashAccount(userId: UUID, now: Date, openingBalance = 0): PaymentAccount {
  return {
    id: defaultCashAccountId(userId),
    user_id: userId,
    name: 'Efectivo',
    kind: 'cash',
    opening_balance: openingBalance,
    created_at: now,
    updated_at: now,
  };
}
