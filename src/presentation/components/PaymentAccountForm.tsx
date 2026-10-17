'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { validatePaymentAccount } from '../../core/use-cases/validatePaymentAccount';
import { parseOpeningBalance } from '../../core/use-cases/parseOpeningBalance';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';
import { PaymentAccount, PaymentAccountKind } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ACCOUNT_KIND_LABELS: Record<PaymentAccountKind, string> = {
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Efectivo',
  savings: 'Ahorro',
};

const KIND_OPTIONS = (Object.keys(ACCOUNT_KIND_LABELS) as PaymentAccountKind[]).map(kind => ({ kind, label: ACCOUNT_KIND_LABELS[kind] }));

/** Signed integer cents -> the text shown in the opening-balance field ("-300.00" for a debt). */
function openingBalanceToInput(cents: number): string {
  return `${cents < 0 ? '-' : ''}${centsToAmountInput(Math.abs(cents))}`;
}

interface Props {
  userId: string;
  /** Editing an existing account (name, kind and opening balance); omit to create one. */
  existing?: PaymentAccount;
  onSaved: (account: PaymentAccount) => void;
  onCancel: () => void;
  /** Chrome-less title; omit when the host already shows one. */
  title?: string;
}

/**
 * Create/edit form for a payment account, shared by Settings and the transfer empty state.
 * The opening balance is integer cents via `parseOpeningBalance`; only credit may be negative.
 */
export default function PaymentAccountForm({ userId, existing, onSaved, onCancel, title }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<PaymentAccountKind>(existing?.kind ?? 'debit');
  const [openingBalance, setOpeningBalance] = useState(existing ? openingBalanceToInput(existing.opening_balance) : '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const input = { name, kind, opening_balance: parseOpeningBalance(openingBalance, kind) };
      validatePaymentAccount(input);
      const saved = await new LocalPaymentAccountRepository().save({
        id: existing?.id ?? '',
        user_id: userId,
        archived: existing?.archived,
        sort_order: existing?.sort_order,
        ...input,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {title && <h2 className="mb-4 font-heading text-base leading-none font-medium">{title}</h2>}
      <form onSubmit={handleSubmit} data-testid="payment-account-form" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">Nombre de la cuenta</Label>
          <Input
            id="account-name"
            type="text"
            autoFocus
            autoComplete="off"
            placeholder="Ej. BCP Débito"
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-kind">Tipo</Label>
          <Select value={kind} onValueChange={value => setKind((value ?? 'debit') as PaymentAccountKind)}>
            <SelectTrigger id="account-kind" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map(option => <SelectItem key={option.kind} value={option.kind}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-opening-balance">Saldo inicial</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground" aria-hidden="true">S/</span>
            <Input
              id="account-opening-balance"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="pl-9"
              placeholder="0.00"
              value={openingBalance}
              onChange={event => setOpeningBalance(event.target.value.replace(/[^0-9.,-]/g, ''))}
            />
          </div>
          {kind === 'credit' && <p className="text-body-sm text-muted-foreground">Si ya debés algo en esta tarjeta, escribilo en negativo (ej. -300.00).</p>}
        </div>

        {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">Cancelar</Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="animate-spin" />}
            {existing ? 'Guardar cuenta' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </div>
  );
}
