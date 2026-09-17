'use client';

import React, { useState } from 'react';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DebtDirection } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function DebtForm({ userId, onComplete, onCancel }: Props) {
  const [counterpartyName, setCounterpartyName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountInCents = Math.round(parseFloat(amount.replace(/,/g, '')) * 100);
    try {
      validateMovementAmount(amountInCents);
    } catch (err) {
      if (err instanceof DomainError) {
        setAmountError(err.message);
      }
      return;
    }
    setAmountError(null);

    setIsSubmitting(true);

    try {
      const repo = new LocalDebtRepository();

      await repo.save({
        id: '', // Handled by repo UUID generation
        user_id: userId,
        counterparty_name: counterpartyName,
        direction,
        origin: 'manual',
        amount: amountInCents,
        settled_amount: 0,
        due_date: dueDate ? new Date(dueDate) : undefined,
        interest_rate: interestRate ? Number(interestRate) : undefined,
      });

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Nuevo Préstamo</h2>
      <form onSubmit={handleSubmit} data-testid="debt-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="counterpartyName">Nombre de la persona</Label>
          <Input
            type="text"
            id="counterpartyName"
            required
            placeholder="Ej. Juan"
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="direction">Dirección</Label>
          <select
            id="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as DebtDirection)}
            className="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none"
          >
            <option value="lent">Le presté yo</option>
            <option value="borrowed">Me prestaron a mí</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground text-base font-medium">S/</span>
            </div>
            <Input
              type="text"
              id="amount"
              required
              className="pl-9"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9.]/g, ''));
                if (amountError) setAmountError(null);
              }}
            />
          </div>
          {amountError && <p className="text-sm text-destructive">{amountError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Fecha de vencimiento (Opcional)</Label>
          <Input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interestRate">Interés % (Opcional, informativo)</Label>
          <Input
            type="text"
            id="interestRate"
            placeholder="0"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>
      </form>
    </div>
  );
}
