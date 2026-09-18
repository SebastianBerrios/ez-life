'use client';

import React, { useState } from 'react';
import { LocalProfileRepository } from '../../infrastructure/repositories/local/LocalProfileRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import { uuidv7 } from 'uuidv7';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  profileId: string;
  onComplete: (profileId: string) => void;
}

export default function OnboardingStep1({ profileId, onComplete }: Props) {
  const [income, setIncome] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const profileRepo = new LocalProfileRepository();
      const incomeRepo = new LocalIncomeSourceRepository();

      // Use the authenticated session's real id — never mint a fresh one here.
      // A local-only id would orphan every row this wizard creates from RLS
      // (which requires user_id === auth.uid()), so it would never sync.
      await profileRepo.save({
        id: profileId
      });

      // We save the base income in cents
      const incomeInCents = Math.round(parseFloat(income) * 100);

      await incomeRepo.save({
        id: uuidv7(),
        user_id: profileId,
        name: 'Sueldo Base',
        amount: incomeInCents,
      });

      onComplete(profileId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-card border border-border p-6 rounded-2xl shadow-warm-sm">
      <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">Paso 1: Configuración Básica</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="space-y-2">
          <Label htmlFor="income">
            Sueldo o Ingreso Base (Mensual)
          </Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground text-base">S/</span>
            </div>
            <Input
              type="number"
              name="income"
              id="income"
              required
              step="0.01"
              min="0"
              className="pl-10"
              placeholder="0.00"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Guardando...' : 'Continuar'}
        </Button>
      </form>
    </div>
  );
}
