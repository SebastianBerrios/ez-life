import type { MonthBalance } from '../domain/models/types';

/**
 * Projects `MonthBalance.cards` into an `accountId -> owed` map consumed by
 * `buildPendingRegistrations` (used by both `useSummaryData` and `useNotificationEvaluator`).
 */
export function selectCardOwed(balance: MonthBalance): Record<string, number> {
  const map: Record<string, number> = {};
  for (const card of balance.cards) {
    map[card.accountId] = card.owed;
  }
  return map;
}
