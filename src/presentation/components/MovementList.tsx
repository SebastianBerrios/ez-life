'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { Movement } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';

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

  if (loading) return <div className="text-center py-4 text-muted-foreground">Cargando...</div>;

  if (movements.length === 0) {
    return (
      <div className="text-center py-8 bg-card rounded-xl shadow-sm border border-border">
        <p className="text-muted-foreground">No hay movimientos en este mes.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <ul className="divide-y divide-border">
        {movements.map(m => (
          <li key={m.id} className="p-4 hover:bg-muted flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-foreground">{m.description || 'Sin descripción'}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(m.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-bold ${m.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {m.type === 'INCOME' ? '+' : '-'} S/ {(m.amount / 100).toFixed(2)}
              </span>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-destructive hover:text-destructive/80 text-xs font-medium"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
