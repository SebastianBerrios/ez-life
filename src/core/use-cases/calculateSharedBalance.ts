import { SharedMovement, UUID } from '../domain/models/types';

export interface PairBalance {
  fromUserId: UUID; // owes
  toUserId: UUID; // is owed
  amount: number; // cents
}

/**
 * "Quién le debe a quién" — derived on-demand from SharedMovements, never
 * persisted (research.md #3, Principio VII): recomputing here is always
 * correct even after a movement is edited or deleted, with no denormalized
 * balance to keep in sync.
 *
 * Whoever registered a movement (`created_by`) is assumed to have fronted
 * the full amount; every other member's `share_cents` is what they owe back.
 */
export function calculateSharedBalance(movements: SharedMovement[]): PairBalance[] {
  const owed = new Map<string, number>();

  for (const movement of movements) {
    for (const split of movement.splits) {
      if (split.user_id === movement.created_by) continue;
      if (split.share_cents <= 0) continue;

      const key = `${split.user_id}|${movement.created_by}`;
      owed.set(key, (owed.get(key) ?? 0) + split.share_cents);
    }
  }

  const seen = new Set<string>();
  const result: PairBalance[] = [];

  for (const [key, amount] of Array.from(owed.entries())) {
    if (seen.has(key)) continue;
    const [debtor, creditor] = key.split('|');
    const reverseKey = `${creditor}|${debtor}`;
    const reverseAmount = owed.get(reverseKey) ?? 0;
    seen.add(key);
    seen.add(reverseKey);

    const net = amount - reverseAmount;
    if (net > 0) {
      result.push({ fromUserId: debtor, toUserId: creditor, amount: net });
    } else if (net < 0) {
      result.push({ fromUserId: creditor, toUserId: debtor, amount: -net });
    }
  }

  return result;
}
