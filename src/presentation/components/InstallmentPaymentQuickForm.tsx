'use client';

import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { LocalInstallmentLoanRepository } from '../../infrastructure/repositories/local/LocalInstallmentLoanRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { DomainError } from '../../core/domain/errors/DomainError';
import type { InstallmentLoan, PaymentAccount } from '../../core/domain/models/types';
import { formatMoney } from '../../core/use-cases/formatMoney';
import { pickPrimaryAccount } from '../../core/use-cases/pickPrimaryAccount';
import { usableAccounts } from '../../core/use-cases/transferAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountChips, FieldLabel } from './quickRecordUi';

interface Props {
  userId: string;
  loanId: string;
  initialAccountId?: string;
  amountCents?: number;
  description?: string;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * Compact installment payment confirmation rendered inside `QuickRecordSheet`
 * when the user clicks "Registrar" on a loan item in "Por registrar".
 */
export default function InstallmentPaymentQuickForm({
  userId,
  loanId,
  initialAccountId,
  amountCents,
  description,
  onComplete,
  onCancel,
}: Props) {
  const [loan, setLoan] = useState<InstallmentLoan | null | undefined>(undefined);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [accountId, setAccountId] = useState<string>(initialAccountId ?? '');
  const [countInput, setCountInput] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const accountLabelId = useId();

  useEffect(() => {
    let active = true;
    Promise.all([
      new LocalInstallmentLoanRepository().getAll(userId),
      new LocalPaymentAccountRepository().getAll(userId).catch(() => [] as PaymentAccount[]),
    ])
      .then(([loans, loadedAccounts]) => {
        if (!active) return;
        setLoan(loans.find(item => item.id === loanId) ?? null);
        setAccounts(loadedAccounts);
        const usable = usableAccounts(loadedAccounts);
        const preferred =
          (initialAccountId && usable.find(a => a.id === initialAccountId))
          ?? pickPrimaryAccount(loadedAccounts, userId)
          ?? usable[0];
        if (preferred) setAccountId(preferred.id);
      })
      .catch(err => {
        console.error(err);
        if (active) setLoan(null);
      });
    return () => { active = false; };
  }, [userId, loanId, initialAccountId]);

  if (loan === undefined) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (loan === null) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4" data-testid="loan-quick-missing">
        <p className="text-body-md text-muted-foreground">No encontramos ese préstamo.</p>
        <Button type="button" variant="outline" onClick={onCancel} className="w-full">
          Cerrar
        </Button>
      </div>
    );
  }

  const usable = usableAccounts(accounts, accountId);
  const installmentCents = amountCents ?? loan.installment_amount;
  const parsedCount = parseInt(countInput, 10);
  const totalPreview = Number.isInteger(parsedCount) && parsedCount > 0 ? installmentCents * parsedCount : installmentCents;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      setError('Ingresa una cantidad válida de cuotas.');
      return;
    }

    setSubmitting(true);
    try {
      const repo = new LocalInstallmentLoanRepository();
      await repo.recordInstallmentPayment(loan.id, parsedCount, new Date(), accountId || undefined);
      onComplete();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'No se pudo registrar el pago de cuota.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="loan-quick-form" className="space-y-4">
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-sm text-muted-foreground">{description ?? `Cuota de ${loan.lender_name}`}</p>
          <p className="font-fredoka text-2xl font-semibold text-foreground">{formatMoney(totalPreview)}</p>
          <p className="text-body-sm text-muted-foreground">
            Quedan {loan.remaining_installments} de {loan.installment_count} cuotas
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="loan-quick-count">Cuotas a pagar</FieldLabel>
          <Input
            id="loan-quick-count"
            type="number"
            min={1}
            max={loan.remaining_installments}
            value={countInput}
            onChange={e => {
              setCountInput(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        {usable.length > 0 && (
          <div>
            <FieldLabel icon={Wallet} id={accountLabelId}>Cuenta de origen</FieldLabel>
            <AccountChips
              labelId={accountLabelId}
              name="loan-payment-account"
              accounts={usable}
              value={accountId}
              onChange={setAccountId}
            />
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={submitting} className="flex-1">
          {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Registrar cuota
        </Button>
      </div>
    </form>
  );
}
