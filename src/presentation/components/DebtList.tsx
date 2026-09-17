'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { Debt } from '../../core/domain/models/types';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

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
    const draft = paymentDrafts[debt.id] ?? '';
    const amountInCents = Math.round(parseFloat(draft.replace(/,/g, '')) * 100);

    try {
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
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No tenés préstamos registrados.</p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-slide-up space-y-4">
      {debts.map(debt => {
        const remaining = debt.amount - debt.settled_amount;
        const isSettled = remaining <= 0;
        const directionLabel = debt.direction === 'lent' ? 'Le prestaste a' : 'Te prestó';

        return (
          <Card key={debt.id} className="relative shadow-warm-sm">
            <div className="flex items-start justify-between px-5">
              <div>
                <h3 className="font-heading font-bold text-foreground">
                  {directionLabel} {debt.counterparty_name}
                </h3>
                {debt.due_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Vence: {new Date(debt.due_date).toLocaleDateString()}
                  </p>
                )}
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

            <div className="mt-4 space-y-1 px-5">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">S/ {(remaining / 100).toFixed(2)} pendiente</span>
                <span className="text-muted-foreground">de S/ {(debt.amount / 100).toFixed(2)}</span>
              </div>
            </div>

            {!isSettled && (
              <div className="mt-4 px-5 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Monto de la devolución"
                    value={paymentDrafts[debt.id] ?? ''}
                    onChange={(e) => setPaymentDrafts(prev => ({
                      ...prev,
                      [debt.id]: e.target.value.replace(/[^0-9.]/g, ''),
                    }))}
                  />
                  <Button size="sm" onClick={() => handleRegisterPayment(debt)}>
                    Registrar devolución
                  </Button>
                </div>
                {paymentErrors[debt.id] && (
                  <p className="text-sm text-destructive">{paymentErrors[debt.id]}</p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleMarkSettled(debt)}>
                  Marcar como saldado
                </Button>
              </div>
            )}

            {isSettled && (
              <p className="mt-4 px-5 text-sm text-primary font-medium">Saldado ✓</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
