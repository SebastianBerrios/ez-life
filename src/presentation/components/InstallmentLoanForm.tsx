'use client';

import React, { useState } from 'react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import { InstallmentLoan } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  existing?: InstallmentLoan;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Registers or corrects an installment loan's original terms (FR-011,
 * FR-012, FR-022). Deliberately no amortization math here — every value the
 * user enters is stored exactly as-is, never derived from the others
 * (FR-012, FR-013): the app is a ledger for what the lender already told
 * them, not a calculator that could disagree with it.
 */
export default function InstallmentLoanForm({ userId, existing, onComplete, onCancel }: Props) {
  const isEditing = Boolean(existing);
  const [lenderName, setLenderName] = useState(existing?.lender_name ?? '');
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toFixed(2) : '');
  const [installmentCount, setInstallmentCount] = useState(existing ? String(existing.installment_count) : '');
  const [installmentAmount, setInstallmentAmount] = useState(existing ? (existing.installment_amount / 100).toFixed(2) : '');
  const [interestRate, setInterestRate] = useState(existing?.interest_rate !== undefined ? String(existing.interest_rate) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountInCents = Math.round(parseFloat(amount.replace(/,/g, '')) * 100);
    const installmentAmountInCents = Math.round(parseFloat(installmentAmount.replace(/,/g, '')) * 100);
    const installmentCountValue = parseInt(installmentCount, 10);

    try {
      validateMovementAmount(amountInCents);
      validateMovementAmount(installmentAmountInCents);
      if (!Number.isInteger(installmentCountValue) || installmentCountValue <= 0) {
        throw new DomainError('El número de cuotas debe ser un entero mayor a 0.');
      }
    } catch (err) {
      if (err instanceof DomainError) setError(err.message);
      return;
    }
    setError(null);

    setIsSubmitting(true);
    try {
      const repo = new LocalInstallmentLoanRepository();
      const interestRateValue = interestRate ? Number(interestRate) : undefined;

      if (isEditing && existing) {
        await repo.updateTerms(existing.id, {
          amount: amountInCents,
          installmentCount: installmentCountValue,
          installmentAmount: installmentAmountInCents,
          interestRate: interestRateValue,
        });
      } else {
        await repo.create({
          id: '',
          user_id: userId,
          lender_name: lenderName,
          amount: amountInCents,
          installment_count: installmentCountValue,
          installment_amount: installmentAmountInCents,
          interest_rate: interestRateValue,
        });
      }

      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">
        {isEditing ? 'Corregir préstamo con cuotas' : 'Nuevo préstamo con cuotas'}
      </h2>
      <form onSubmit={handleSubmit} data-testid="installment-loan-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="lenderName">Entidad financiera</Label>
          <Input
            type="text"
            id="lenderName"
            required
            placeholder="Ej. BCP"
            value={lenderName}
            onChange={(e) => setLenderName(e.target.value)}
          />
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
              onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); if (error) setError(null); }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="installmentCount">N° de cuotas</Label>
          <Input
            type="text"
            id="installmentCount"
            required
            placeholder="12"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="installmentAmount">Monto de cuota</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground text-base font-medium">S/</span>
            </div>
            <Input
              type="text"
              id="installmentAmount"
              required
              className="pl-9"
              placeholder="0.00"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Registrar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
