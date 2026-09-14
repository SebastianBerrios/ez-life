'use client';

import React, { useState } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { uuidv7 } from 'uuidv7';

interface Props {
  onComplete: (profileId: string) => void;
}

export default function OnboardingStep1({ onComplete }: Props) {
  const [income, setIncome] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const profileRepo = new LocalProfileRepository();
      const incomeRepo = new LocalIncomeSourceRepository();
      
      const userId = uuidv7(); 
      
      // We save the profile
      await profileRepo.save({
        id: userId
      });

      // We save the base income in cents
      const incomeInCents = Math.round(parseFloat(income) * 100);
      
      await incomeRepo.save({
        id: uuidv7(),
        user_id: userId,
        name: 'Sueldo Base',
        amount: incomeInCents,
      });

      onComplete(userId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Paso 1: Configuración Básica</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
          <label htmlFor="income" className="block text-sm font-medium text-gray-700">Sueldo o Ingreso Base (Mensual)</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">S/</span>
            </div>
            <input
              type="number"
              name="income"
              id="income"
              required
              step="0.01"
              min="0"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
              placeholder="0.00"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
