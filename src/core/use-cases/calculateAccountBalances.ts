import type { Movement, PaymentAccount } from '../domain/models/types';
import { calendarKey } from './calendar';

/**
 * Balance per payment account: opening balance + income - expense - transfers
 * out + transfers in (accountId -> cents). Balance adjustments count (they are
 * real money moves); soft-deleted rows are ignored; movements without an
 * account are not attributed to any (see `calculateUnassignedBalance`).
 * When an account defines `opening_date`, movements dated on an earlier local
 * calendar day are ignored for that account (spec 013 R2).
 */
export function calculateAccountBalances(accounts: PaymentAccount[], movements: Movement[]): Record<string, number> {
  const balances: Record<string, number> = {};
  const openingDays: Record<string, string> = {};
  for (const account of accounts) {
    if (!account.deleted_at) {
      balances[account.id] = account.opening_balance;
      if (account.opening_date) {
        openingDays[account.id] = calendarKey(account.opening_date);
      }
    }
  }
  const apply = (accountId: string | undefined, delta: number, moveDay: string) => {
    if (accountId === undefined || !(accountId in balances)) return;
    const openDay = openingDays[accountId];
    if (openDay !== undefined && moveDay < openDay) return;
    balances[accountId] += delta;
  };

  for (const m of movements) {
    if (m.deleted_at) continue;
    const moveDay = calendarKey(m.date);
    if (m.type === 'TRANSFER') {
      apply(m.account_id, -m.amount, moveDay);
      apply(m.to_account_id, m.amount, moveDay);
    } else {
      apply(m.account_id, m.type === 'INCOME' ? m.amount : -m.amount, moveDay);
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
