'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { Debt } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { formatShortDate } from '../../core/use-cases/formatMovementWhen';
import { dueDayStart } from '../../core/use-cases/calendar';
import { formatInformalDebtPhrase } from '../../core/use-cases/formatFinancesPhrases';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { onLocalChanges } from '../../infrastructure/db/localChanges';

interface Props {
  userId: string;
  hideEmpty?: boolean;
}

export default function DebtList({ userId, hideEmpty = false }: Props) {
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
      // recordSettlement never creates a Movement — it's bookkeeping only (Principio X).
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
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    );
  }

  if (debts.length === 0) {
    if (hideEmpty) return null;
    return (
      <p className="py-2 text-body-md text-muted-foreground">No tienes préstamos registrados.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="debts">
      <p className="px-1 text-xs font-medium text-muted-foreground">Deudas informales</p>
      {debts.map(debt => {
        const remaining = Math.max(0, debt.amount - debt.settled_amount);
        const isSettled = remaining <= 0;
        const settledPercent = debt.amount > 0 ? Math.min(100, Math.round((debt.settled_amount * 100) / debt.amount)) : 0;
        const phrase = formatInformalDebtPhrase(debt);

        return (
          <Panel key={debt.id} className="gap-4 p-5" data-testid={`debt-${debt.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                  <HandCoins className="size-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 font-fredoka text-headline-sm text-foreground">
                    {phrase}
                    <Badge variant={isSettled ? 'positive' : 'warning'}>{isSettled ? 'Saldado' : 'Pendiente'}</Badge>
                  </h4>
                  {debt.due_date && (
                    <p className="text-xs text-muted-foreground">
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
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="flex items-baseline gap-1.5 text-foreground">
                  <Money cents={remaining} size="sm" className="font-semibold" />
                  <span className="text-muted-foreground">pendiente</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  de <Money cents={debt.amount} size="sm" className="text-muted-foreground" />
                </span>
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
          </Panel>
        );
      })}
    </div>
  );
}
