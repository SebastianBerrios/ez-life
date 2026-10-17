import type { Movement, PaymentAccount } from '../domain/models/types';

/**
 * Balance per payment account: opening balance + income - expense - transfers
 * out + transfers in (accountId -> cents). Balance adjustments count (they are
 * real money moves); soft-deleted rows are ignored; movements without an
 * account are not attributed to any (see `calculateUnassignedBalance`).
 */
export function calculateAccountBalances(accounts: PaymentAccount[], movements: Movement[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of accounts) {
    if (!account.deleted_at) balances[account.id] = account.opening_balance;
  }
  const apply = (accountId: string | undefined, delta: number) => {
    if (accountId !== undefined && accountId in balances) balances[accountId] += delta;
  };

  for (const m of movements) {
    if (m.deleted_at) continue;
    if (m.type === 'TRANSFER') {
      apply(m.account_id, -m.amount);
      apply(m.to_account_id, m.amount);
    } else {
      apply(m.account_id, m.type === 'INCOME' ? m.amount : -m.amount);
    }
  }
  return balances;
}

/** Net (income - expense) of movements not tied to any account. Transfers never count. */
export function calculateUnassignedBalance(movements: Movement[]): number {
  let total = 0;
  for (const m of movements) {
    if (m.deleted_at || m.account_id || m.type === 'TRANSFER') continue;
    total += m.type === 'INCOME' ? m.amount : -m.amount;
  }
  return total;
}

export function calculateTotalBalance(
  accounts: PaymentAccount[],
  balances: Record<string, number>,
  options: { includeArchived?: boolean } = {},
): number {
  const includeArchived = options.includeArchived ?? true;
  return accounts
    .filter(a => !a.deleted_at && (includeArchived || !a.archived))
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);
}
