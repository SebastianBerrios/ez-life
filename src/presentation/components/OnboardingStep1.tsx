'use client';

import React, { useState } from 'react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';

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
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 1 de 3" title="Paso 1: Configuración Básica" titleAs="h2" />
        <PanelBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="income">
                Sueldo o Ingreso Base (Mensual)
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="font-mono text-body-md text-muted-foreground">S/</span>
                </div>
                <Input
                  type="number"
                  name="income"
                  id="income"
                  required
                  step="0.01"
                  min="0"
                  className="pl-10 tabular-nums"
                  placeholder="0.00"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                />
              </div>
            </div>

            {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Guardando...' : 'Continuar'}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
