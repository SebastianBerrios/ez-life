'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { validateNewCreditCard, validatePaymentAccount } from '../../core/use-cases/validatePaymentAccount';
import { parseOpeningBalance } from '../../core/use-cases/parseOpeningBalance';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseDayOfMonth } from '../../core/use-cases/parseDayOfMonth';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';
import { countActiveFields, formatMoreOptionsLabel, hasAdvancedFieldError } from '../../core/use-cases/formAdvancedFields';
import { PaymentAccount, PaymentAccountKind } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ACCOUNT_KIND_LABELS: Record<PaymentAccountKind, string> = {
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Efectivo',
  savings: 'Ahorro',
};

const KIND_OPTIONS = (Object.keys(ACCOUNT_KIND_LABELS) as PaymentAccountKind[]).map(kind => ({ kind, label: ACCOUNT_KIND_LABELS[kind] }));

function openingBalanceToInput(cents: number): string {
  return `${cents < 0 ? '-' : ''}${centsToAmountInput(Math.abs(cents))}`;
}

interface Props {
  userId: string;
  existing?: PaymentAccount;
  onSaved: (account: PaymentAccount) => void;
  onCancel: () => void;
  title?: string;
}

export default function PaymentAccountForm({ userId, existing, onSaved, onCancel, title }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<PaymentAccountKind>(existing?.kind ?? 'debit');
  const [openingBalance, setOpeningBalance] = useState(existing ? openingBalanceToInput(existing.opening_balance) : '');
  const [creditLimit, setCreditLimit] = useState(
    existing?.credit_limit !== undefined ? centsToAmountInput(existing.credit_limit) : '',
  );
  const [closingDay, setClosingDay] = useState(
    existing?.closing_day !== undefined ? String(existing.closing_day) : '',
  );
  const [paymentDay, setPaymentDay] = useState(
    existing?.payment_day !== undefined ? String(existing.payment_day) : '',
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const creditLimitIsEssential = !existing && kind === 'credit';
  const hasOpeningBalance = openingBalance.trim() !== '' && openingBalance.trim() !== '0' && openingBalance.trim() !== '0.00';
  const activeAdvancedCount = countActiveFields([
    hasOpeningBalance,
    Boolean(existing && kind === 'credit' && creditLimit.trim() !== ''),
    kind === 'credit' && closingDay.trim() !== '',
    kind === 'credit' && paymentDay.trim() !== '',
  ]);
  const moreOptionsLabel = formatMoreOptionsLabel(activeAdvancedCount);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    let inAdvancedStep = false;
    try {
      let parsedOpening = 0;
      let parsedCreditLimit: number | undefined;
      let parsedClosingDay: number | undefined;
      let parsedPaymentDay: number | undefined;

      inAdvancedStep = true;
      parsedOpening = parseOpeningBalance(openingBalance, kind);
      if (kind === 'credit') {
        inAdvancedStep = !creditLimitIsEssential;
        parsedCreditLimit = creditLimit.trim() !== '' ? parseMoney(creditLimit) : undefined;
        inAdvancedStep = true;
        parsedClosingDay = parseDayOfMonth(closingDay);
        parsedPaymentDay = parseDayOfMonth(paymentDay);
      }
      inAdvancedStep = false;

      const creditFields = kind === 'credit'
        ? {
            credit_limit: parsedCreditLimit,
            closing_day: parsedClosingDay,
            payment_day: parsedPaymentDay,
          }
        : {};
      const input = {
        name,
        kind,
        opening_balance: parsedOpening,
        ...creditFields,
      };
      validatePaymentAccount(input);
      if (!existing && kind === 'credit') {
        validateNewCreditCard(input);
      }
      const saved = await new LocalPaymentAccountRepository().save({
        id: existing?.id ?? '',
        user_id: userId,
        archived: existing?.archived,
        sort_order: existing?.sort_order,
        ...(existing?.opening_date ? { opening_date: existing.opening_date } : {}),
        ...input,
      });
      onSaved(saved);
    } catch (err) {
      if (hasAdvancedFieldError([inAdvancedStep])) {
        setAdvancedOpen(true);
      }
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {title && <h2 className="mb-4 font-fredoka text-headline-sm text-foreground">{title}</h2>}
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

        {creditLimitIsEssential && (
          <div className="space-y-2">
            <Label htmlFor="account-credit-limit">Línea de crédito</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground" aria-hidden="true">S/</span>
              <Input
                id="account-credit-limit"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="pl-9"
                placeholder="5000.00"
                value={creditLimit}
                onChange={event => setCreditLimit(event.target.value.replace(/[^0-9.,]/g, ''))}
              />
            </div>
          </div>
        )}

        <CollapsibleSection
          variant="inline"
          title={moreOptionsLabel}
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          testId="account-more-options"
        >
          <div className="space-y-4">
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
              {kind === 'credit' && <p className="text-body-sm text-muted-foreground">Si ya debes algo en esta tarjeta, escríbelo en negativo (ej. -300.00).</p>}
            </div>

            {kind === 'credit' && !creditLimitIsEssential && (
              <div className="space-y-2">
                <Label htmlFor="account-credit-limit">Línea de crédito</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground" aria-hidden="true">S/</span>
                  <Input
                    id="account-credit-limit"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="pl-9"
                    placeholder="5000.00"
                    value={creditLimit}
                    onChange={event => setCreditLimit(event.target.value.replace(/[^0-9.,]/g, ''))}
                  />
                </div>
              </div>
            )}

            {kind === 'credit' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="account-closing-day">Día de cierre</Label>
                  <Input
                    id="account-closing-day"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej. 25"
                    value={closingDay}
                    onChange={event => setClosingDay(event.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-payment-day">Día de pago</Label>
                  <Input
                    id="account-payment-day"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej. 15"
                    value={paymentDay}
                    onChange={event => setPaymentDay(event.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex gap-3 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
