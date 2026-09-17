'use client';

import React, { useState } from 'react';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { createSharedMovement } from '../../core/use-cases/createSharedMovement';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import { Membership, SharedMovementSplitMode, SharedMovementType } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Props {
  spaceId: string;
  currentUserId: string;
  members: Membership[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function SharedMovementForm({ spaceId, currentUserId, members, onComplete, onCancel }: Props) {
  const [type, setType] = useState<SharedMovementType>('expense');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitMode, setSplitMode] = useState<SharedMovementSplitMode>('percentage');
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(members.map(m => [m.user_id, String((100 / members.length).toFixed(2))]))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const totalAmountCents = Math.round(parseFloat(totalAmount.replace(/,/g, '')) * 100);
    try {
      validateMovementAmount(totalAmountCents);
    } catch (err) {
      if (err instanceof DomainError) setError(err.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const splits = splitMode === 'percentage'
        ? createSharedMovement({
            createdBy: currentUserId,
            totalAmountCents,
            splitMode,
            splits: members.map(m => ({ user_id: m.user_id, percentage: parseFloat(shares[m.user_id] || '0') })),
          })
        : createSharedMovement({
            createdBy: currentUserId,
            totalAmountCents,
            splitMode,
            splits: members.map(m => ({ user_id: m.user_id, amount_cents: Math.round(parseFloat(shares[m.user_id] || '0') * 100) })),
          });

      const repo = new LocalSharedMovementRepository();
      await repo.create({
        id: '',
        sharedSpaceId: spaceId,
        type,
        totalAmountCents,
        splitMode,
        splits,
        date: new Date(),
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4 font-heading text-base leading-none font-medium">Nuevo Movimiento Compartido</h2>
      <form onSubmit={handleSubmit} data-testid="shared-movement-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="movementType">Tipo</Label>
          <select
            id="movementType"
            value={type}
            onChange={(e) => setType(e.target.value as SharedMovementType)}
            className="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none"
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAmount">Monto total</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-muted-foreground text-base font-medium">S/</span>
            </div>
            <Input
              type="text"
              id="totalAmount"
              required
              className="pl-9"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Cómo se divide?</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="splitMode"
                value="percentage"
                checked={splitMode === 'percentage'}
                onChange={() => setSplitMode('percentage')}
              />
              Por porcentaje
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="splitMode"
                value="fixed_amount"
                aria-label="Monto fijo"
                checked={splitMode === 'fixed_amount'}
                onChange={() => setSplitMode('fixed_amount')}
              />
              Monto fijo
            </label>
          </div>
        </fieldset>

        <div className="space-y-3">
          {members.map(m => (
            <div key={m.user_id} className="space-y-1">
              <Label htmlFor={`share-${m.user_id}`}>
                Parte de {m.user_id === currentUserId ? 'vos' : m.user_id} {splitMode === 'percentage' ? '(%)' : '(S/)'}
              </Label>
              <Input
                type="text"
                id={`share-${m.user_id}`}
                value={shares[m.user_id] ?? ''}
                onChange={(e) => setShares(prev => ({ ...prev, [m.user_id]: e.target.value.replace(/[^0-9.]/g, '') }))}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
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
