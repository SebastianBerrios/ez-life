'use client';

import React, { useState } from 'react';
import { LocalDebtRepository } from '../../infrastructure/repositories/local/LocalDebtRepository';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { parseCalendarDate } from '../../core/use-cases/calendar';
import { countActiveFields, formatMoreOptionsLabel, hasAdvancedFieldError } from '../../core/use-cases/formAdvancedFields';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DebtDirection } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const activeAdvancedCount = countActiveFields([
    dueDate.trim() !== '',
    interestRate.trim() !== '',
  ]);
  const moreOptionsLabel = formatMoreOptionsLabel(activeAdvancedCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    let amountInCents = 0;
    try {
      amountInCents = parseMoney(amount);
      validateMovementAmount(amountInCents);
    } catch (err) {
      if (err instanceof DomainError) {
        setAmountError(err.message);
      }
      return;
    }
    setAmountError(null);

    let parsedDueDate: Date | undefined;
    try {
      parsedDueDate = dueDate ? parseCalendarDate(dueDate) : undefined;
    } catch (err) {
      if (err instanceof DomainError) {
        setDateError(err.message);
        if (hasAdvancedFieldError([true])) setAdvancedOpen(true);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const repo = new LocalDebtRepository();

      await repo.save({
        id: '',
        user_id: userId,
        counterparty_name: counterpartyName,
        direction,
        origin: 'manual',
        amount: amountInCents,
        settled_amount: 0,
        due_date: parsedDueDate,
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
      <h2 className="mb-4 font-fredoka text-headline-sm text-foreground">Nuevo préstamo</h2>
      <form onSubmit={handleSubmit} data-testid="debt-form" className="space-y-4">
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
          <Select value={direction} onValueChange={(val) => setDirection((val ?? 'lent') as DebtDirection)}>
            <SelectTrigger id="direction" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lent">Le presté yo</SelectItem>
              <SelectItem value="borrowed">Me prestaron a mí</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-base font-medium text-muted-foreground">S/</span>
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
          {amountError && <p role="alert" className="text-sm text-destructive">{amountError}</p>}
        </div>

        <CollapsibleSection
          variant="inline"
          title={moreOptionsLabel}
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          testId="debt-more-options"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de vencimiento (opcional)</Label>
              <Input
                type="date"
                id="dueDate"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); setDateError(null); }}
              />
              {dateError && <p role="alert" className="text-sm text-destructive">{dateError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRate">Interés % (opcional, informativo)</Label>
              <Input
                type="text"
                id="interestRate"
                placeholder="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
          </div>
        </CollapsibleSection>

        <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex gap-3 border-t border-border/60 bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
