'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { Debt } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { formatShortDate } from '../../core/use-cases/formatMovementWhen';
import { dueDayStart } from '../../core/use-cases/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { onLocalChanges } from '../../infrastructure/db/localChanges';

interface Props {
  userId: string;
}

const EYEBROW = 'font-mono text-label-mono-xs uppercase text-muted-foreground';

export default function DebtList({ userId }: Props) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});

  const loadDebts = useCallback(async () => {
    try {
      const repo = new LocalDebtRepository();
      setDebts(await repo.getAll(userId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDebts();
    // A debt changed from another tab or by a sync pull must show up without remounting.
    return onLocalChanges(['debts'], loadDebts);
  }, [loadDebts]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este préstamo?')) return;
    try {
      const repo = new LocalDebtRepository();
      await repo.delete(id);
      await loadDebts();
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const handleRegisterPayment = async (debt: Debt) => {
    try {
      const amountInCents = parseMoney(paymentDrafts[debt.id] ?? '');
      const repo = new LocalDebtRepository();
      // recordSettlement never creates a Movement — it's bookkeeping only
      // (FR-004, Principio X): a devolución nunca es un ingreso/egreso real.
      await repo.recordSettlement(debt.id, amountInCents);
      setPaymentDrafts(prev => ({ ...prev, [debt.id]: '' }));
      setPaymentErrors(prev => ({ ...prev, [debt.id]: '' }));
      await loadDebts();
    } catch (err) {
      const message = err instanceof DomainError ? err.message : 'No se pudo registrar la devolución.';
      setPaymentErrors(prev => ({ ...prev, [debt.id]: message }));
    }
  };

  const handleMarkSettled = async (debt: Debt) => {
    const remaining = debt.amount - debt.settled_amount;
    if (remaining <= 0) return;
    try {
      const repo = new LocalDebtRepository();
      await repo.recordSettlement(debt.id, remaining);
      await loadDebts();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <p className="animate-fade-slide-up py-2 text-body-md text-muted-foreground">No tienes préstamos registrados.</p>
    );
  }

  return (
    <div className="animate-fade-slide-up flex flex-col gap-3" data-testid="debts">
      <p className={EYEBROW}>Informales</p>
      {debts.map(debt => {
        const remaining = debt.amount - debt.settled_amount;
        const isSettled = remaining <= 0;
        const directionLabel = debt.direction === 'lent' ? 'Le prestaste a' : 'Te prestó';
        const settledPercent = debt.amount > 0 ? Math.min(100, Math.round((debt.settled_amount * 100) / debt.amount)) : 0;

        return (
          <article key={debt.id} className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4" data-testid={`debt-${debt.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary">
                  <HandCoins className="size-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 text-headline-sm text-foreground">
                    {directionLabel} {debt.counterparty_name}
                    <Badge variant={isSettled ? 'positive' : 'warning'}>{isSettled ? 'Saldado' : 'Pendiente'}</Badge>
                  </h4>
                  {debt.due_date && (
                    <p className="font-mono text-label-mono-xs text-muted-foreground">
                      Vence: {formatShortDate(dueDayStart(debt.due_date))}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(debt.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Borrar
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="flex items-baseline gap-2 text-body-md text-primary">
                  <Money cents={remaining} size="md" className="font-semibold" />
                  <span>pendiente</span>
                </span>
                <span className="text-body-sm text-muted-foreground">de <Money cents={debt.amount} size="sm" className="text-muted-foreground" /></span>
              </div>
              <Progress value={settledPercent} aria-label={`Devuelto de ${debt.counterparty_name}`} />
            </div>

            {!isSettled && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label="Monto de la devolución"
                    placeholder="Monto de la devolución"
                    value={paymentDrafts[debt.id] ?? ''}
                    onChange={(e) => setPaymentDrafts(prev => ({
                      ...prev,
                      [debt.id]: e.target.value.replace(/[^0-9.]/g, ''),
                    }))}
                  />
                  <Button className="shrink-0" onClick={() => handleRegisterPayment(debt)}>
                    Registrar devolución
                  </Button>
                </div>
                {paymentErrors[debt.id] && (
                  <p className="text-body-sm text-destructive">{paymentErrors[debt.id]}</p>
                )}
                <Button variant="outline" className="w-full" onClick={() => handleMarkSettled(debt)}>
                  Marcar como saldado
                </Button>
              </div>
            )}

            {isSettled && (
              <p className="text-body-md font-medium text-success">Saldado ✓</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
