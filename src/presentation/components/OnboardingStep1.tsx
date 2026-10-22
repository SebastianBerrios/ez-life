'use client';

import React, { useState } from 'react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseCurrentBalance } from '../../core/use-cases/parseCurrentBalance';
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
  const [balance, setBalance] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await new LocalOnboardingRepository().saveStartingPoint(profileId, {
        income: parseMoney(income),
        openingBalance: parseCurrentBalance(balance),
      });

      onComplete(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu punto de partida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 1 de 3" title="Tu punto de partida" titleAs="h2" />
        <PanelBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="income">
                Sueldo o ingreso mensual
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

            <div className="space-y-2">
              <Label htmlFor="openingBalance">
                Saldo actual (opcional)
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="font-mono text-body-md text-muted-foreground">S/</span>
                </div>
                <Input
                  type="number"
                  name="openingBalance"
                  id="openingBalance"
                  step="0.01"
                  min="0"
                  className="pl-10 tabular-nums"
                  placeholder="0.00"
                  aria-describedby="openingBalance-help"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>
              <p id="openingBalance-help" className="text-body-md text-muted-foreground">
                Lo que tienes hoy entre efectivo y cuentas. Puedes ajustarlo después en Ajustes → Cuentas.
              </p>
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
