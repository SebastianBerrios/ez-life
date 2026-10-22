'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { calculateSharedBalance, PairBalance } from '../../core/use-cases/calculateSharedBalance';
import { useSharedSpaceRealtime } from '../hooks/useSharedSpaceRealtime';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Money } from '@/components/ui/money';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  spaceId: string;
  currentUserId: string;
  refreshKey: number;
}

/**
 * "Quién le debe a quién" (FR-010, SC-004) — recalculated on every load, not
 * a persisted balance (research.md #3). useSharedSpaceRealtime keeps it
 * current within seconds while both members are online (SC-003).
 */
export default function SharedSpaceBalances({ spaceId, currentUserId, refreshKey }: Props) {
  const [balances, setBalances] = useState<PairBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const repo = new LocalSharedMovementRepository();
      const movements = await repo.getAllForSpace(spaceId);
      setBalances(calculateSharedBalance(movements));
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
    // Realtime triggers a sync in the background; poll locally right after
    // so this view picks it up without waiting for the next mount.
    const interval = setInterval(() => setReloadKey(k => k + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  if (balances.length === 0) {
    return (
      <Panel data-testid="shared-balances-empty">
        <PanelBody className="py-6 text-center">
          <p className="text-body-md text-muted-foreground">No hay saldos pendientes en este espacio.</p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel aria-label="Saldos" data-testid="shared-balances">
      <PanelHeader eyebrow="Quién le debe a quién" title="Saldos" titleAs="h3" />
      <PanelBody>
        <ul className="divide-y divide-border">
          {balances.map((b, i) => {
            const sentence = b.fromUserId === currentUserId
              ? `Tú le debes a ${b.toUserId}`
              : b.toUserId === currentUserId
                ? `${b.fromUserId} te debe`
                : `${b.fromUserId} le debe a ${b.toUserId}`;
            // What the signed-in user owes reads as an expense; what they are owed reads as income.
            const tone = b.fromUserId === currentUserId ? 'expense' : b.toUserId === currentUserId ? 'income' : 'neutral';
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 break-words text-body-md text-muted-foreground">
                  {sentence}
                </span>
                <Money cents={b.amount} sign="never" tone={tone} size="md" className="font-semibold" />
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}
