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
    <div className="max-w-md mx-auto bg-card border border-border p-6 rounded-2xl shadow-sm">
      <h2 className="text-2xl font-bold text-foreground mb-6">Paso 1: Configuración Básica</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label htmlFor="income" className="block text-base font-medium text-foreground">
            Sueldo o Ingreso Base (Mensual)
          </label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground text-base">S/</span>
            </div>
            <input
              type="number"
              name="income"
              id="income"
              required
              step="0.01"
              min="0"
              className="focus:ring-ring focus:border-ring block w-full h-11 pl-10 text-base border-input rounded-xl py-2.5 border bg-background text-foreground focus:outline-none focus:ring-2 transition-colors"
              placeholder="0.00"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-semibold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
