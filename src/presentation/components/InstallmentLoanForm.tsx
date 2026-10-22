'use client';

import React, { useEffect, useState } from 'react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, InstallmentLoan } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';

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
  const [amount, setAmount] = useState(existing ? centsToAmountInput(existing.amount) : '');
  const [installmentCount, setInstallmentCount] = useState(existing ? String(existing.installment_count) : '');
  const [installmentAmount, setInstallmentAmount] = useState(existing ? centsToAmountInput(existing.installment_amount) : '');
  const [interestRate, setInterestRate] = useState(existing?.interest_rate !== undefined ? String(existing.interest_rate) : '');
  // FR-010/FR-011: every loan needs a real distribution bucket before it can
  // accept a payment, since each payment now generates an expense Movement
  // (constitution v2.0.0 Principio X) that must count in the 50/30/20 split.
  const [distCategoryId, setDistCategoryId] = useState(existing?.distribution_category_id ?? '');
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      const catRepo = new LocalCategoryRepository();
      const cats = await catRepo.getDistributionCategories(userId);
      setDistCategories(cats);
      setCategoriesLoaded(true);
    };
    loadCategories();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const installmentCountValue = parseInt(installmentCount, 10);
    let amountInCents = 0;
    let installmentAmountInCents = 0;

    try {
      amountInCents = parseMoney(amount);
      installmentAmountInCents = parseMoney(installmentAmount);
      validateMovementAmount(amountInCents);
      validateMovementAmount(installmentAmountInCents);
      if (!Number.isInteger(installmentCountValue) || installmentCountValue <= 0) {
        throw new DomainError('El número de cuotas debe ser un entero mayor a 0.');
      }
      if (!distCategoryId) {
        throw new DomainError('Elige una categoría de distribución (50/30/20) para este préstamo.');
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
          distributionCategoryId: distCategoryId,
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
          distribution_category_id: distCategoryId,
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
          <Label htmlFor="distCategory">Categoría (50/30/20)</Label>
          {categoriesLoaded ? (
            <Select value={distCategoryId} onValueChange={(val) => { setDistCategoryId(val || ''); if (error) setError(null); }}>
              <SelectTrigger id="distCategory">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {distCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-11 w-full rounded-xl" />
          )}
        </div>

        <details open={Boolean(existing?.interest_rate)} className="border-t border-border pt-2"><summary className="text-sm font-medium">Opciones adicionales</summary><div className="space-y-4 pt-3">
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

        </div></details>

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
