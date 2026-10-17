'use client';

import React, { useEffect, useState } from 'react';
import { LocalSharedMovementRepository } from '../../infrastructure/repositories/local/LocalSharedMovementRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { createSharedMovement } from '../../core/use-cases/createSharedMovement';
import { parseMoney } from '../../core/use-cases/parseMoney';
import { validateMovementAmount } from '../../core/use-cases/validateMovementAmount';
import { DomainError } from '../../core/domain/errors/DomainError';
import { DistributionCategory, Membership, SharedMovementSplitMode, SharedMovementType } from '../../core/domain/models/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioChips } from './formUi';

interface Props {
  spaceId: string;
  currentUserId: string;
  members: Membership[];
  /** Pre-fills the form when it is reached from the quick-record sheet ("¿Afecta al Espacio Compartido?"). */
  initial?: { amount?: string };
  onComplete: () => void;
  onCancel: () => void;
}

const SPLIT_OPTIONS: { value: SharedMovementSplitMode; label: string }[] = [
  { value: 'percentage', label: 'Por porcentaje' },
  { value: 'fixed_amount', label: 'Monto fijo' },
];

export default function SharedMovementForm({ spaceId, currentUserId, members, initial, onComplete, onCancel }: Props) {
  const [type, setType] = useState<SharedMovementType>('expense');
  const [totalAmount, setTotalAmount] = useState(initial?.amount ?? '');
  const [splitMode, setSplitMode] = useState<SharedMovementSplitMode>('percentage');
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(members.map(m => [m.user_id, String((100 / members.length).toFixed(2))]))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The creator's own buckets, so their own share can count in their budget
  // breakdown (FR-012) — a non-creator member's share stays uncategorized,
  // the creator has no access to their private DistributionCategory rows.
  const [distCategories, setDistCategories] = useState<DistributionCategory[]>([]);
  const [distCategoryId, setDistCategoryId] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      const catRepo = new LocalCategoryRepository();
      const cats = await catRepo.getDistributionCategories(currentUserId);
      setDistCategories(cats);
      if (cats[0]) setDistCategoryId(cats[0].id);
    };
    loadCategories();
  }, [currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Money is parsed strictly into integer cents (never `parseFloat * 100`); percentages stay numeric.
    let totalAmountCents: number;
    try {
      totalAmountCents = parseMoney(totalAmount);
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
            splits: members.map(m => ({ user_id: m.user_id, amount_cents: parseMoney(shares[m.user_id] || '0') })),
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
        creatorDistributionCategoryId: type === 'expense' && distCategoryId ? distCategoryId : undefined,
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
      <p className="font-mono text-label-mono-xs uppercase text-muted-foreground">Espacio compartido</p>
      <h2 className="mb-4 text-headline-md text-foreground">Nuevo Movimiento Compartido</h2>
      <form onSubmit={handleSubmit} data-testid="shared-movement-form" className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="movementType">Tipo</Label>
          <Select value={type} onValueChange={(val) => setType((val ?? 'expense') as SharedMovementType)}>
            <SelectTrigger id="movementType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Gasto</SelectItem>
              <SelectItem value="income">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAmount">Monto total</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="font-mono text-body-md text-muted-foreground">S/</span>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              id="totalAmount"
              required
              className="pl-9 tabular-nums"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
        </div>

        {type === 'expense' && distCategories.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="creatorDistCat">Tu categoría (50/30/20, opcional)</Label>
            <Select value={distCategoryId} onValueChange={(val) => setDistCategoryId(val || '')}>
              <SelectTrigger id="creatorDistCat" className="w-full">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                {distCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <p id="shared-split-label" className="text-body-md font-medium text-foreground">¿Cómo se divide?</p>
          <RadioChips
            name="splitMode"
            labelId="shared-split-label"
            value={splitMode}
            options={SPLIT_OPTIONS}
            onChange={setSplitMode}
          />
        </div>

        <div className="space-y-3">
          {members.map(m => (
            <div key={m.user_id} className="space-y-1">
              <Label htmlFor={`share-${m.user_id}`}>
                Parte de {m.user_id === currentUserId ? 'vos' : m.user_id} {splitMode === 'percentage' ? '(%)' : '(S/)'}
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                id={`share-${m.user_id}`}
                className="tabular-nums"
                value={shares[m.user_id] ?? ''}
                onChange={(e) => setShares(prev => ({ ...prev, [m.user_id]: e.target.value.replace(/[^0-9.]/g, '') }))}
              />
            </div>
          ))}
        </div>

        {error && <p role="alert" className="text-body-md text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="animate-spin" />}
            Registrar
          </Button>
        </div>
      </form>
    </div>
  );
}
