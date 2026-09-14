'use client';

import React, { useEffect, useState } from 'react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { Movement } from '../../core/domain/models/types';
import { calculateMonthlyCycle } from '../../core/use-cases/calculateMonthlyCycle';

interface Props {
  userId: string;
}

export default function MovementList({ userId }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [userId]);

  const loadMovements = async () => {
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
  };

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

  if (loading) return <div className="text-center py-4 text-gray-500">Cargando...</div>;

  if (movements.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500">No hay movimientos en este mes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {movements.map(m => (
          <li key={m.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">{m.description || 'Sin descripción'}</p>
              <p className="text-xs text-gray-500">
                {new Date(m.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-bold ${m.type === 'INCOME' ? 'text-green-600' : 'text-gray-900'}`}>
                {m.type === 'INCOME' ? '+' : '-'} S/ {(m.amount / 100).toFixed(2)}
              </span>
              <button 
                onClick={() => handleDelete(m.id)}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
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
