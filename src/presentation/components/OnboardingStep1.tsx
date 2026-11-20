'use client';

import React, { useMemo, useState } from 'react';
import { LocalOnboardingRepository } from '../../infrastructure/repositories/local/LocalOnboardingRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseDayOfMonth } from '../../core/use-cases/parseDayOfMonth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

interface Props {
  profileId: string;
  onComplete: (profileId: string) => void;
}

function tryParsePositiveMoney(text: string): number | null {
  if (!text.trim()) return null;
  try {
    const cents = parseMoney(text);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

export default function OnboardingStep1({ profileId, onComplete }: Props) {
  const [income, setIncome] = useState<string>('');
  const [payDayText, setPayDayText] = useState<string>('');
  const [receivedThisMonth, setReceivedThisMonth] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incomeError, setIncomeError] = useState('');
  const [payDayError, setPayDayError] = useState('');
  const [formError, setFormError] = useState('');

  const validIncomeCents = useMemo(() => tryParsePositiveMoney(income), [income]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncomeError('');
    setPayDayError('');
    setFormError('');

    let parsedIncome: number;
    try {
      parsedIncome = parseMoney(income);
      if (parsedIncome <= 0) {
        setIncomeError('Ingresa un monto mayor a cero.');
        return;
      }
    } catch (err) {
      setIncomeError(err instanceof Error ? err.message : 'Ingresa un monto válido.');
      return;
    }

    let parsedPayDay: number | undefined;
    try {
      parsedPayDay = parseDayOfMonth(payDayText);
    } catch (err) {
      setPayDayError(err instanceof Error ? err.message : 'Ingresa un día entre 1 y 31.');
      return;
    }

    setIsSubmitting(true);
    try {
      await new LocalOnboardingRepository().saveIncome(profileId, {
        income: parsedIncome,
        payDay: parsedPayDay,
        receivedThisMonth,
      });
      onComplete(profileId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudieron guardar tus ingresos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Panel>
        <PanelHeader eyebrow="Paso 1 de 6" title="Tus ingresos" titleAs="h2" />
        <PanelBody>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="income">Ingreso mensual</Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-body-md text-muted-foreground">S/</span>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  name="income"
                  id="income"
                  className="pl-10 tabular-nums"
                  placeholder="0.00"
                  value={income}
                  onChange={(e) => {
                    setIncome(e.target.value);
                    setIncomeError('');
                  }}
                />
              </div>
              {incomeError && <p role="alert" className="text-sm text-destructive">{incomeError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payDay">¿Qué día te pagan? (opcional)</Label>
              <Input
                type="text"
                inputMode="numeric"
                name="payDay"
                id="payDay"
                className="tabular-nums"
                placeholder="Ej. 28"
                value={payDayText}
                onChange={(e) => {
                  setPayDayText(e.target.value);
                  setPayDayError('');
                }}
              />
              {payDayError && <p role="alert" className="text-sm text-destructive">{payDayError}</p>}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                ¿Ya recibiste tu sueldo de este mes?
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'Sí' },
                  { value: false, label: 'No' },
                ].map(option => {
                  const selected = receivedThisMonth === option.value;
                  return (
                    <label
                      key={option.label}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors',
                        selected
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <input
                        type="radio"
                        name="receivedThisMonth"
                        value={option.value ? 'yes' : 'no'}
                        checked={selected}
                        onChange={() => setReceivedThisMonth(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

            <Button type="submit" size="lg" disabled={validIncomeCents === null || isSubmitting} className="w-full">
              {isSubmitting ? 'Guardando...' : 'Continuar'}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </div>
  );
}
