'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowDownUp, CalendarDays, CheckCircle2, Loader2, PencilLine, Wallet } from 'lucide-react';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { calendarKey, combineDateAndTime, parseCalendarDate, timeKey } from '../../core/use-cases/calendar';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { validateTransfer } from '../../core/use-cases/validateTransfer';
import {
  canTransfer, defaultTransferPair, selectTransferAccount, swapTransferPair, usableAccounts, type TransferPair,
} from '../../core/use-cases/transferAccounts';
import { DomainError } from '../../core/domain/errors/DomainError';
import { PaymentAccount } from '../../core/domain/models/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AmountHero from './AmountHero';
import PaymentAccountForm from './PaymentAccountForm';
import { AccountChips, DateTimeRow, FieldLabel } from './quickRecordUi';

interface Props {
  userId: string;
  onComplete: () => void;
  autoFocusAmount?: boolean;
}

/**
 * "Mover" tab: moves money between two of the user's own accounts. A transfer is a `TRANSFER`
 * movement (never income nor expense). With fewer than two accounts the form explains why and
 * offers to create one right here.
 */
export default function TransferForm({ userId, onComplete, autoFocusAmount = false }: Props) {
  const [accounts, setAccounts] = useState<PaymentAccount[] | null>(null);
  const [pair, setPair] = useState<TransferPair | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(calendarKey(new Date()));
  const [time, setTime] = useState(timeKey(new Date()));
  const [amountError, setAmountError] = useState<string | null>(null);
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
      const stillValid = current && usableAccounts(loaded).some(a => a.id === current.fromId) && usableAccounts(loaded).some(a => a.id === current.toId);
      return stillValid ? current : defaultTransferPair(loaded, userId);
    });
  }, [userId]);

  useEffect(() => {
    void loadAccounts().catch(error => console.error(error));
  }, [loadAccounts]);

  if (accounts === null) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
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
      <div className="rounded-lg border border-border bg-card p-6 text-center" data-testid="transfer-empty">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-surface-3 text-muted-foreground">
          <ArrowDownUp className="size-5" aria-hidden="true" />
        </div>
        <h3 className="text-headline-sm text-foreground">Necesitas al menos dos cuentas</h3>
        <p className="mx-auto mt-1 max-w-xs text-body-md text-muted-foreground">
          Para mover dinero entre cuentas propias tienes que tener un origen y un destino distintos.
        </p>
        <Button className="mt-4" onClick={() => setCreatingAccount(true)}>Crear cuenta</Button>
      </div>
    );
  }

  const choices = usableAccounts(accounts);

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

    let amountInCents: number;
    let when: Date;
    try {
      amountInCents = parseMoney(amount);
      validateMovementAmount(amountInCents);
      parseCalendarDate(date);
      when = combineDateAndTime(date, time);
    } catch (err) {
      if (err instanceof DomainError) setAmountError(err.message);
      return;
    }
    setAmountError(null);

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
        badge={<Badge>TRANSFERENCIA</Badge>}
        error={amountError}
        onChange={value => {
          setAmount(value);
          if (amountError) setAmountError(null);
        }}
      />

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
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

        <div>
          <FieldLabel icon={CalendarDays}>Fecha y hora</FieldLabel>
          <DateTimeRow date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
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

      {formError && <p role="alert" className="text-body-md text-destructive">{formError}</p>}

      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border bg-popover px-4 pb-4 pt-3">
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Guardar transferencia
        </Button>
      </div>
    </form>
  );
}
