'use client';

import React, { useState } from 'react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
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
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await new LocalOnboardingRepository().saveIncome(profileId, parseMoney(income));

      onComplete(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ingreso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-card border border-border p-6 rounded-xl shadow-none">
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

        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Guardando...' : 'Continuar'}
        </Button>
      </form>
    </div>
  );
}
