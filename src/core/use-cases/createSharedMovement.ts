import { DomainError } from '../domain/errors/DomainError';
import { SharedMovementSplit, SharedMovementSplitMode, UUID } from '../domain/models/types';

export interface SplitPercentageInput {
  user_id: UUID;
  percentage: number;
}

export interface SplitFixedInput {
  user_id: UUID;
  amount_cents: number;
}

export interface ComputeSharedMovementSplitsInput {
  createdBy: UUID;
  totalAmountCents: number;
  splitMode: SharedMovementSplitMode;
  splits: SplitPercentageInput[] | SplitFixedInput[];
}

/**
 * Validates and finalizes the per-member shares for a shared movement.
 * Persistence (the SharedMovement row + one linked Movement per member) is
 * the `create_shared_movement` RPC's job (contracts/rpc-functions.md) — it
 * writes a Movement row for OTHER members too, which a plain "own rows
 * only" RLS policy can't allow as a direct client insert (Principio IX).
 * This function only computes what to send it.
 */
export function createSharedMovement(input: ComputeSharedMovementSplitsInput): SharedMovementSplit[] {
  if (input.splitMode === 'fixed_amount') {
    const splits = input.splits as SplitFixedInput[];
    const sum = splits.reduce((acc, s) => acc + s.amount_cents, 0);
    if (sum !== input.totalAmountCents) {
      throw new DomainError('La suma de los montos no coincide con el total del gasto.');
    }
    return splits.map(s => ({ user_id: s.user_id, share_cents: s.amount_cents }));
  }

  const percentageSplits = input.splits as SplitPercentageInput[];
  const percentageSum = percentageSplits.reduce((acc, s) => acc + s.percentage, 0);
  if (Math.round(percentageSum) !== 100) {
    throw new DomainError('Los porcentajes deben sumar 100%.');
  }

  const shares = percentageSplits.map(s => ({
    user_id: s.user_id,
    share_cents: Math.floor((input.totalAmountCents * s.percentage) / 100),
  }));

  const allocated = shares.reduce((acc, s) => acc + s.share_cents, 0);
  const remainder = input.totalAmountCents - allocated;

  // The rounding remainder goes to whoever registered the movement
  // (Clarifications, FR-009) — deterministic, never split arbitrarily.
  const creatorShare = shares.find(s => s.user_id === input.createdBy);
  if (creatorShare) {
    creatorShare.share_cents += remainder;
  } else {
    shares[0].share_cents += remainder;
  }

  return shares;
}
