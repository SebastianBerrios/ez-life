import type { Movement } from '../domain/models/types';

export type RecentMovement = Movement & { isTransfer: boolean };

/**
 * The latest `count` non-deleted movements, newest first (ties: most recently created).
 * TRANSFERs are included and flagged (`isTransfer`): they are history, but never income/expense.
 */
export function selectRecentMovements(movements: Movement[], count: number): RecentMovement[] {
  return movements
    .filter(m => !m.deleted_at)
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, Math.max(0, count))
    .map(m => ({ ...m, isTransfer: m.type === 'TRANSFER' }));
}
