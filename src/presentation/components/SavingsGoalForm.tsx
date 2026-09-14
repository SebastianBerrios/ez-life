'use client';

import React, { useState } from 'react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function SavingsGoalForm({ userId, onComplete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const repo = new LocalSavingsGoalRepository();
      const amountInCents = Math.round(parseFloat(targetAmount.replace(/,/g, '')) * 100);
      
      await repo.save({
        id: '', // Handled by repo UUID generation
        user_id: userId,
        name,
        target_amount: amountInCents,
        deadline: deadline ? new Date(deadline) : undefined
      });

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md w-full mb-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Nueva Meta de Ahorro</h2>
      
      <form onSubmit={handleSubmit} data-testid="goal-form" className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre de la Meta</label>
          <input
            type="text"
            id="name"
            required
            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
            placeholder="Ej. Viaje a Cancún"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700">Monto Objetivo</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">S/</span>
            </div>
            <input
              type="text"
              id="targetAmount"
              required
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
              placeholder="0.00"
              value={targetAmount}
              onFocus={() => {
                if (targetAmount) {
                  setTargetAmount(targetAmount.replace(/,/g, ''));
                }
              }}
              onBlur={() => {
                if (targetAmount && !isNaN(Number(targetAmount))) {
                  setTargetAmount(Number(targetAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }
              }}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setTargetAmount(val);
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">Fecha límite (Opcional)</label>
          <input
            type="date"
            id="deadline"
            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Crear Meta
          </button>
        </div>
      </form>
    </div>
  );
}
