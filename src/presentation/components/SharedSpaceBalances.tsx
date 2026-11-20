'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import type { SharedMovement } from '../../core/domain/models/types';
import { calculateSharedBalance, PairBalance } from '../../core/use-cases/calculateSharedBalance';
import { buildSharedSpaceSummary, formatSharedMovementSplit } from '../../core/use-cases/formatSharedSpacePhrases';
import { formatShortDate } from '../../core/use-cases/formatMovementWhen';
import { useSharedSpaceRealtime } from '../hooks/useSharedSpaceRealtime';
import { Panel } from '@/components/ui/panel';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  spaceId: string;
  currentUserId: string;
  refreshKey: number;
  memberNames?: Record<string, string>;
}

/**
 * Shared-space net balance hero, natural per-member phrases, and readable shared movements list
 * (no tables or hard dividers), preserving best-effort realtime over local offline-first data.
 */
export default function SharedSpaceBalances({ spaceId, currentUserId, refreshKey, memberNames }: Props) {
  const [movements, setMovements] = useState<SharedMovement[]>([]);
  const [balances, setBalances] = useState<PairBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const repo = new LocalSharedMovementRepository();
      const loaded = await repo.getAllForSpace(spaceId);
      const sorted = [...loaded].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(sorted);
      setBalances(calculateSharedBalance(loaded));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load, refreshKey, reloadKey]);

  useSharedSpaceRealtime(spaceId);
  useEffect(() => {
    const interval = setInterval(() => setReloadKey(k => k + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Skeleton className="h-24 w-full rounded-card" />;
  }

  const summary = buildSharedSpaceSummary(balances, currentUserId, memberNames);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        aria-label="Saldos"
        data-testid={summary.pairPhrases.length === 0 ? 'shared-balances-empty' : 'shared-balances'}
        className="gap-3 p-5"
      >
        <div className="space-y-1" data-testid="shared-balances-hero">
          <p className="text-sm font-medium text-muted-foreground">Tu saldo en este espacio</p>
          <p
            className={cn(
              'font-fredoka text-headline-lg-mobile md:text-headline-lg',
              summary.tone === 'positive'
                ? 'text-success'
                : summary.tone === 'negative'
                  ? 'text-expense'
                  : 'text-foreground',
            )}
          >
            {summary.heroPhrase}
          </p>
        </div>

        {summary.pairPhrases.length > 0 && (
          <ul className="flex flex-col gap-2">
            {summary.pairPhrases.map((pair, idx) => (
              <li
                key={`${pair.fromUserId}-${pair.toUserId}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-4 py-3"
              >
                <span className="min-w-0 break-words text-sm font-medium text-foreground">
                  {pair.phrase}
                </span>
                <Money
                  cents={pair.amountCents}
                  sign="never"
                  tone={pair.tone === 'positive' ? 'income' : pair.tone === 'negative' ? 'expense' : 'neutral'}
                  size="sm"
                  className="shrink-0 font-semibold"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {movements.length > 0 && (
        <Panel aria-label="Movimientos compartidos" data-testid="shared-movements-list" className="gap-3 p-5">
          <h3 className="font-fredoka text-headline-sm text-foreground">Movimientos compartidos</h3>
          <ul className="flex flex-col gap-2">
            {movements.map((m) => (
              <li
                key={m.id}
                data-testid={`shared-movement-${m.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {formatSharedMovementSplit(m, currentUserId, memberNames)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.type === 'income' ? 'Ingreso' : 'Gasto'} · {formatShortDate(new Date(m.date))}
                  </p>
                </div>
                <Money
                  cents={m.total_amount_cents}
                  sign="never"
                  tone={m.type === 'income' ? 'income' : 'expense'}
                  size="sm"
                  className="shrink-0 font-semibold"
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
