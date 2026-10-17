'use client';

import React, { useState } from 'react';
import { CalendarDays, PencilLine, Wallet } from 'lucide-react';
import { LocalSavingsGoalRepository } from '../../infrastructure/repositories/local/LocalSavingsGoalRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { calendarKey, parseCalendarDate } from '../../core/use-cases/calendar';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import type { SavingsGoal } from '../../core/domain/models/types';
import { Input } from '@/components/ui/input';
import { FieldLabel } from './quickRecordUi';
import { FormShell } from './formUi';

interface Props {
  userId: string;
  /** Edit mode: the goal to prefill and update. */
  existing?: SavingsGoal;
  /** Hides the form's own title (the host sheet already shows one). */
  embedded?: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

/** Cents -> "1500.50" without going through floats. */
function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export default function SavingsGoalForm({ userId, existing, embedded, onComplete, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(existing ? centsToInput(existing.target_amount) : '');
  const [deadline, setDeadline] = useState(existing?.deadline ? calendarKey(existing.deadline) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let amountInCents: number;
    try {
      amountInCents = parseMoney(targetAmount);
      validateMovementAmount(amountInCents);
    } catch (err) {
      if (err instanceof DomainError) setAmountError(err.message);
      return;
    }
    setAmountError(null);

    let deadlineValue: Date | undefined;
    try {
      deadlineValue = deadline ? parseCalendarDate(deadline) : undefined;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La fecha no es válida.');
      return;
    }

    setIsSubmitting(true);

    try {
      const repo = new LocalSavingsGoalRepository();

      await repo.save({
        id: existing?.id ?? '', // empty: the repository generates the UUID
        user_id: userId,
        name,
        target_amount: amountInCents,
        deadline: deadlineValue,
      });

      onComplete();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar la meta de ahorro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormShell
      title={existing ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}
      embedded={embedded}
      testId="goal-form"
      onSubmit={handleSubmit}
      error={error}
      submitLabel={existing ? 'Guardar cambios' : 'Crear meta'}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    >
      <div>
        <FieldLabel icon={PencilLine} htmlFor="name">Nombre de la Meta</FieldLabel>
        <Input
          type="text"
          id="name"
          required
          placeholder="Ej. Viaje a Cancún"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <FieldLabel icon={Wallet} htmlFor="targetAmount">Monto Objetivo</FieldLabel>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-body-md font-medium text-muted-foreground">S/</span>
          </div>
          <Input
            type="text"
            inputMode="decimal"
            id="targetAmount"
            required
            className="pl-9"
            placeholder="0.00"
            value={targetAmount}
            aria-invalid={amountError ? true : undefined}
            onFocus={() => {
              if (targetAmount) {
                setTargetAmount(targetAmount.replace(/,/g, ''));
              }
            }}
            onBlur={() => {
              if (targetAmount && !isNaN(Number(targetAmount))) {
                setTargetAmount(
                  Number(targetAmount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                );
              }
            }}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setTargetAmount(val);
              if (amountError) setAmountError(null);
            }}
          />
        </div>
        {amountError && <p role="alert" className="mt-1 text-body-md text-destructive">{amountError}</p>}
      </div>

      <details open={Boolean(existing?.deadline)} className="border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-mono text-label-mono-xs uppercase text-muted-foreground">Opciones adicionales</summary>
        <div className="pt-2">
          <FieldLabel icon={CalendarDays} htmlFor="deadline" hint="Opcional">Fecha límite</FieldLabel>
          <Input
            type="date"
            id="deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </details>
    </FormShell>
  );
}
