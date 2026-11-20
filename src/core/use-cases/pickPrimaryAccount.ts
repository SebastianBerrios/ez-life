import type { PaymentAccount } from '../domain/models/types';

function compareDeterministic(a: PaymentAccount, b: PaymentAccount): number {
  return a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id);
}

/**
 * Default origin account for loan payments and card transfers: oldest active
 * `debit` account (by `created_at`, tie-broken by `id`); if none exists, the
 * oldest active `cash` ("Efectivo") account; `undefined` if neither exists.
 * Never persisted as a flag — strictly derived.
 */
export function pickPrimaryAccount(accounts: PaymentAccount[], userId: string): PaymentAccount | undefined {
  const active = accounts.filter(a => a.user_id === userId && !a.deleted_at && !a.archived);
  const debits = active.filter(a => a.kind === 'debit').sort(compareDeterministic);
  if (debits.length > 0) return debits[0];
  const cash = active.filter(a => a.kind === 'cash').sort(compareDeterministic);
  return cash[0];
}
