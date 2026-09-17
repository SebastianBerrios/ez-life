'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { Movement } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  userId: string;
}

export default function MovementList({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMovements = useCallback(async () => {
    try {
      const repo = new LocalMovementRepository();
      const [start, end] = calculateMonthlyCycle(new Date());
      const data = await repo.getAllByCycle(userId, start, end);
      // Sort newest first
      data.sort((a, b) => b.date.getTime() - a.date.getTime());
      setMovements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento?')) return;
    try {
      const repo = new LocalMovementRepository();
      await repo.delete(id);
      await loadMovements();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <Card className="animate-fade-slide-up py-8 text-center shadow-warm-sm">
        <p className="text-muted-foreground">No hay movimientos en este mes.</p>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-slide-up overflow-hidden py-0 shadow-warm-sm">
      <ul className="divide-y divide-border">
        {movements.map(m => (
          <li
            key={m.id}
            className="flex items-center justify-between p-5 transition-colors hover:bg-muted"
          >
            <div>
              <p className="text-base font-medium text-foreground">{m.description || 'Sin descripción'}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(m.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-base font-bold ${m.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {m.type === 'INCOME' ? '+' : '-'} S/ {(m.amount / 100).toFixed(2)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(m.id)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
