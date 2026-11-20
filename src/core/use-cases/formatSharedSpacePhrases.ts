import type { SharedMovement } from '../domain/models/types';
import type { PairBalance } from './calculateSharedBalance';
import { formatMoney } from './formatMoney';

export interface SharedPairPhrase {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  tone: 'positive' | 'negative' | 'neutral';
  phrase: string;
}

export interface SharedSpaceNetSummary {
  netCents: number;
  tone: 'positive' | 'negative' | 'settled';
  heroPhrase: string;
  pairPhrases: SharedPairPhrase[];
}

function resolveMemberName(userId: string, memberNames?: Record<string, string>): string {
  const raw = memberNames?.[userId]?.trim();
  return raw && raw.length > 0 ? raw : 'Otro miembro';
}

export function buildSharedSpaceSummary(
  balances: PairBalance[],
  currentUserId: string,
  memberNames?: Record<string, string>,
): SharedSpaceNetSummary {
  let netCents = 0;
  const pairPhrases: SharedPairPhrase[] = [];

  for (const b of balances) {
    if (b.amount <= 0) continue;

    if (b.toUserId === currentUserId) {
      netCents += b.amount;
      const fromName = resolveMemberName(b.fromUserId, memberNames);
      pairPhrases.push({
        fromUserId: b.fromUserId,
        toUserId: b.toUserId,
        amountCents: b.amount,
        tone: 'positive',
        phrase: `${fromName} te debe ${formatMoney(b.amount)}`,
      });
    } else if (b.fromUserId === currentUserId) {
      netCents -= b.amount;
      const toName = resolveMemberName(b.toUserId, memberNames);
      pairPhrases.push({
        fromUserId: b.fromUserId,
        toUserId: b.toUserId,
        amountCents: b.amount,
        tone: 'negative',
        phrase: `Le debes ${formatMoney(b.amount)} a ${toName}`,
      });
    } else {
      const fromName = resolveMemberName(b.fromUserId, memberNames);
      const toName = resolveMemberName(b.toUserId, memberNames);
      pairPhrases.push({
        fromUserId: b.fromUserId,
        toUserId: b.toUserId,
        amountCents: b.amount,
        tone: 'neutral',
        phrase: `${fromName} le debe ${formatMoney(b.amount)} a ${toName}`,
      });
    }
  }

  if (netCents > 0) {
    return {
      netCents,
      tone: 'positive',
      heroPhrase: `Te deben ${formatMoney(netCents)}`,
      pairPhrases,
    };
  }
  if (netCents < 0) {
    return {
      netCents,
      tone: 'negative',
      heroPhrase: `Debes ${formatMoney(Math.abs(netCents))}`,
      pairPhrases,
    };
  }
  return {
    netCents: 0,
    tone: 'settled',
    heroPhrase: 'Están al día',
    pairPhrases,
  };
}

export function formatSharedMovementSplit(
  movement: Pick<SharedMovement, 'created_by' | 'split_mode' | 'splits'>,
  currentUserId: string,
  memberNames?: Record<string, string>,
): string {
  const payer =
    movement.created_by === currentUserId
      ? 'Pagaste tú'
      : `Pagó ${resolveMemberName(movement.created_by, memberNames)}`;

  const shares = movement.splits.map((s) => s.share_cents);
  const isEqualSplit =
    movement.split_mode === 'percentage' &&
    shares.length > 1 &&
    Math.max(...shares) - Math.min(...shares) <= 1;

  const splitLabel = isEqualSplit ? 'dividido en partes iguales' : 'división personalizada';
  return `${payer} · ${splitLabel}`;
}
