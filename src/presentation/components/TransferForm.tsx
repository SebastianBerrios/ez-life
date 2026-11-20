'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowDownUp, CalendarDays, CheckCircle2, Loader2, PencilLine, Wallet } from 'lucide-react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { centsToAmountInput } from '../../core/use-cases/addQuickAmount';
import { calendarKey, combineDateAndTime, parseCalendarDate, timeKey } from '../../core/use-cases/calendar';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { validateTransfer } from '../../core/use-cases/validateTransfer';
import {
  canTransfer, defaultTransferPair, selectTransferAccount, swapTransferPair, usableAccounts, type TransferPair,
} from '../../core/use-cases/transferAccounts';
import { countActiveFields, formatMoreOptionsLabel, hasAdvancedFieldError } from '../../core/use-cases/formAdvancedFields';
import { DomainError } from '../../core/domain/errors/DomainError';
import { PaymentAccount } from '../../core/domain/models/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import AmountHero from './AmountHero';
import PaymentAccountForm from './PaymentAccountForm';
import { AccountChips, DateTimeRow, FieldLabel } from './quickRecordUi';

export interface TransferInitialValues {
  amountCents?: number;
  fromAccountId?: string;
  toAccountId?: string;
  description?: string;
}

interface Props {
  userId: string;
  onComplete: () => void;
  autoFocusAmount?: boolean;
  initialValues?: TransferInitialValues;
}

export default function TransferForm({ userId, onComplete, autoFocusAmount = false, initialValues }: Props) {
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [pair, setPair] = useState<TransferPair | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [amount, setAmount] = useState(
    initialValues?.amountCents !== undefined ? centsToAmountInput(initialValues.amountCents) : ''
  );
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const initialDateRef = useRef(calendarKey(new Date()));
  const initialTimeRef = useRef(timeKey(new Date()));
  const [date, setDate] = useState(initialDateRef.current);
  const [time, setTime] = useState(initialTimeRef.current);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const fromLabelId = useId();
  const toLabelId = useId();

  const loadAccounts = useCallback(async () => {
    const loaded = await new LocalPaymentAccountRepository().getAll(userId);
    setAccounts(loaded);
    setPair(current => {
      const usable = usableAccounts(loaded);
      const stillValid = current && usable.some(a => a.id === current.fromId) && usable.some(a => a.id === current.toId);
      if (stillValid) return current;

      const wantFrom = initialValues?.fromAccountId && usable.some(a => a.id === initialValues.fromAccountId)
        ? initialValues.fromAccountId : undefined;
      const wantTo = initialValues?.toAccountId && usable.some(a => a.id === initialValues.toAccountId)
        ? initialValues.toAccountId : undefined;
      if (wantFrom && wantTo && wantFrom !== wantTo) {
        return { fromId: wantFrom, toId: wantTo };
      }
      if (wantTo) {
        const altFrom = usable.find(a => a.id !== wantTo)?.id;
        if (altFrom) return { fromId: altFrom, toId: wantTo };
      }
      if (wantFrom) {
        const altTo = usable.find(a => a.id !== wantFrom)?.id;
        if (altTo) return { fromId: wantFrom, toId: altTo };
      }
      return defaultTransferPair(loaded, userId);
    });
  }, [userId, initialValues?.fromAccountId, initialValues?.toAccountId]);

  useEffect(() => {
    void loadAccounts().catch(error => console.error(error));
  }, [loadAccounts]);

  if (accounts === null) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!canTransfer(accounts) || !pair) {
    if (creatingAccount) {
      return (
        <PaymentAccountForm
          userId={userId}
          title="Nueva cuenta"
          onCancel={() => setCreatingAccount(false)}
          onSaved={() => {
            setCreatingAccount(false);
            void loadAccounts().catch(error => console.error(error));
          }}
        />
      );
    }
    return (
      <EmptyState
        testId="transfer-empty"
        icon={<ArrowDownUp className="size-5" />}
        title="Necesitas al menos dos cuentas"
        description="Para mover dinero entre cuentas propias tienes que tener un origen y un destino distintos."
        actionLabel="Crear cuenta"
        onAction={() => setCreatingAccount(true)}
      />
    );
  }

  const choices = usableAccounts(accounts);
  const activeAdvancedCount = countActiveFields([
    description.trim().length > 0,
    date !== initialDateRef.current || time !== initialTimeRef.current,
  ]);
  const moreOptionsLabel = formatMoreOptionsLabel(activeAdvancedCount);

  const pick = (side: 'from' | 'to', accountId: string) => {
    const next = selectTransferAccount(pair, side, accountId);
    const swapped = accountId === (side === 'from' ? pair.toId : pair.fromId);
    setPair(next);
    setNotice(swapped ? 'Intercambiamos origen y destino: no pueden ser la misma cuenta.' : null);
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setFormError(null);
    setDateError(null);

    let amountInCents: number;
    try {
      amountInCents = parseMoney(amount);
      validateMovementAmount(amountInCents);
    } catch (err) {
      if (err instanceof DomainError) setAmountError(err.message);
      return;
    }
    setAmountError(null);

    let when: Date;
    try {
      parseCalendarDate(date);
      when = combineDateAndTime(date, time);
    } catch (err) {
      if (err instanceof DomainError) {
        setDateError(err.message);
        if (hasAdvancedFieldError([true])) setAdvancedOpen(true);
      }
      return;
    }

    try {
      validateTransfer({ type: 'TRANSFER', account_id: pair.fromId, to_account_id: pair.toId, is_recurring: false });
    } catch (err) {
      if (err instanceof DomainError) setFormError(err.message);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    try {
      await new LocalMovementRepository().save({
        id: '',
        user_id: userId,
        type: 'TRANSFER',
        account_id: pair.fromId,
        to_account_id: pair.toId,
        amount: amountInCents,
        date: when,
        description,
        is_recurring: false,
      });
      onComplete();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la transferencia.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="transfer-form" className="space-y-4">
      <AmountHero
        value={amount}
        autoFocus={autoFocusAmount}
        badge={<Badge>Transferencia</Badge>}
        error={amountError}
        onChange={value => {
          setAmount(value);
          if (amountError) setAmountError(null);
        }}
      />

      <div className="space-y-4 rounded-2xl bg-card p-4 shadow-card">
        <div>
          <FieldLabel icon={Wallet} id={fromLabelId}>Cuenta de origen</FieldLabel>
          <AccountChips labelId={fromLabelId} name="transfer-from" accounts={choices} value={pair.fromId} onChange={id => pick('from', id)} />
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Intercambiar cuentas"
            onClick={() => { setPair(swapTransferPair(pair)); setNotice(null); }}
          >
            <ArrowDownUp />
          </Button>
        </div>

        <div>
          <FieldLabel icon={Wallet} id={toLabelId}>Cuenta de destino</FieldLabel>
          <AccountChips labelId={toLabelId} name="transfer-to" accounts={choices} value={pair.toId} onChange={id => pick('to', id)} />
        </div>

        <p role="status" aria-live="polite" className={notice ? 'text-body-md text-muted-foreground' : 'sr-only'}>{notice ?? ''}</p>
      </div>

      <CollapsibleSection
        variant="inline"
        title={moreOptionsLabel}
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        testId="transfer-more-options"
      >
        <div className="space-y-4">
          <div>
            <FieldLabel icon={CalendarDays}>Fecha y hora</FieldLabel>
            <DateTimeRow date={date} time={time} onDateChange={(v) => { setDate(v); setDateError(null); }} onTimeChange={(v) => { setTime(v); setDateError(null); }} />
            {dateError && <p role="alert" className="mt-1 text-body-md text-destructive">{dateError}</p>}
          </div>

          <div>
            <FieldLabel icon={PencilLine} htmlFor="transfer-description" hint="Opcional">Concepto / descripción</FieldLabel>
            <Input
              id="transfer-description"
              type="text"
              placeholder="Ej. Pago de tarjeta, retiro de efectivo"
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {formError && <p role="alert" className="text-body-md text-destructive">{formError}</p>}

      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Guardar transferencia
        </Button>
      </div>
    </form>
  );
}
