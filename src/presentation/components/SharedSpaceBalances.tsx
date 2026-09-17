'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { calculateSharedBalance, PairBalance } from '../../core/use-cases/calculateSharedBalance';
import { useSharedSpaceRealtime } from '../hooks/useSharedSpaceRealtime';
import { Card } from '@/components/ui/card';
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
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  if (balances.length === 0) {
    return (
      <Card className="py-6 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No hay saldos pendientes en este espacio.</p>
      </Card>
    );
  }

  return (
    <Card className="shadow-warm-sm px-5 py-4 space-y-2">
      <h3 className="font-heading font-bold text-foreground text-sm">Saldos</h3>
      {balances.map((b, i) => {
        const fromLabel = b.fromUserId === currentUserId ? 'Vos' : b.fromUserId;
        const toLabel = b.toUserId === currentUserId ? 'vos' : b.toUserId;
        return (
          <p key={i} className="text-sm text-muted-foreground">
            {fromLabel} le debe a {toLabel}: <span className="text-primary font-medium">S/ {(b.amount / 100).toFixed(2)}</span>
          </p>
        );
      })}
    </Card>
  );
}
