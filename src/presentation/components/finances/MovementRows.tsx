'use client';

import React from 'react';
import { ArrowLeftRight, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';
import type { Movement } from '../../../core/domain/models/types';
import { describeMovement, type MovementDescription, type MovementLookups } from '../../../core/use-cases/describeMovement';
import { timeKey } from '../../../core/use-cases/calendar';
import { categoryIcon } from '../quickRecordUi';
import MovementRowMenu from './MovementRowMenu';

export interface RowActions {
  onEdit: (movement: Movement) => void;
  onDelete: (movement: Movement) => void;
}

/** Signed amount: income green with "+", expense rose with "−", transfers neutral and unsigned. */
export function MovementAmount({ movement, kind }: { movement: Movement; kind: MovementDescription['kind'] }) {
  if (kind === 'transfer') return <Money cents={movement.amount} sign="never" size="sm" className="font-semibold text-muted-foreground" />;
  if (kind === 'income') return <Money cents={movement.amount} sign="always" tone="income" size="sm" className="font-semibold" />;
  return <Money cents={-movement.amount} sign="auto" tone="expense" size="sm" className="font-semibold" />;
}

function IconTile({ description }: { description: MovementDescription }) {
  const Icon = description.kind === 'transfer'
    ? ArrowLeftRight
    : description.kind === 'income'
      ? Landmark
      : categoryIcon(description.category ?? '');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2',
        description.kind === 'income' ? 'text-success' : description.kind === 'expense' ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function StateBadges({ description }: { description: MovementDescription }) {
  return (
    <>
      {description.adjustment && <Badge>Ajuste</Badge>}
      {description.shared && <Badge variant="primary" className="border-transparent">Compartido</Badge>}
    </>
  );
}

/** Second line of the title block: category (and subcategory) or a neutral label. */
function subLine(description: MovementDescription): string {
  if (description.kind === 'transfer') return 'Transferencia';
  if (!description.hasDescription) return 'Sin descripción';
  if (description.kind === 'income') return description.category ?? 'Ingreso';
  return description.subcategory ? `${description.category} / ${description.subcategory}` : description.category ?? '';
}

interface CardProps extends RowActions {
  movement: Movement;
  lookups: MovementLookups;
}

/** Warm rounded movement card used across all viewports (no rigid table). */
export function MovementCard({ movement, lookups, onEdit, onDelete }: CardProps) {
  const description = describeMovement(movement, lookups);
  return (
    <li
      data-testid={`movement-${movement.id}`}
      data-kind={description.kind}
      className="flex items-center gap-3 rounded-2xl bg-card py-3 pr-2 pl-3.5 shadow-card"
    >
      <IconTile description={description} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-body-md font-medium text-foreground">{description.title}</p>
          {description.bucketLabel && (
            <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-foreground">
              {description.bucketLabel}
            </span>
          )}
          <StateBadges description={description} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{subLine(description)}</span>
          {description.accountName && description.kind !== 'transfer' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{description.accountName}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={movement.date.toISOString()}>{timeKey(movement.date)}</time>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <MovementAmount movement={movement} kind={description.kind} />
        {description.kind === 'transfer' && (
          <p className="max-w-28 truncate text-xs text-muted-foreground">
            {`A: ${description.toAccountName ?? '—'}`}
          </p>
        )}
      </div>
      {description.editable ? (
        <MovementRowMenu label={description.title} onEdit={() => onEdit(movement)} onDelete={() => onDelete(movement)} />
      ) : (
        <span className="size-11 shrink-0" aria-hidden="true" />
      )}
    </li>
  );
}
