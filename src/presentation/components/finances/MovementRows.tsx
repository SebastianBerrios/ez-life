'use client';

import React from 'react';
import { ArrowLeftRight, Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';
import type { Movement } from '../../../core/domain/models/types';
import { describeMovement, type MovementDescription, type MovementLookups } from '../../../core/use-cases/describeMovement';
import { timeKey } from '../../../core/use-cases/calendar';
import { formatShortDate } from '../../../core/use-cases/formatMovementWhen';
import { categoryIcon } from '../quickRecordUi';
import MovementRowMenu from './MovementRowMenu';

export interface RowActions {
  onEdit: (movement: Movement) => void;
  onDelete: (movement: Movement) => void;
}

/** Signed amount: income green with "+", expense rose with "−", transfers neutral and unsigned (never income/expense). */
export function MovementAmount({ movement, kind }: { movement: Movement; kind: MovementDescription['kind'] }) {
  if (kind === 'transfer') return <Money cents={movement.amount} sign="never" size="sm" className="font-semibold text-muted-foreground" />;
  if (kind === 'income') return <Money cents={movement.amount} sign="always" tone="income" size="sm" className="font-semibold" />;
  return <Money cents={-movement.amount} sign="auto" tone="expense" size="sm" className="font-semibold" />;
}

function IconTile({ description, compact = false }: { description: MovementDescription; compact?: boolean }) {
  const Icon = description.kind === 'transfer'
    ? ArrowLeftRight
    : description.kind === 'income'
      ? Landmark
      : categoryIcon(description.category ?? '');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-surface-2',
        compact ? 'size-8' : 'size-10',
        description.kind === 'income' ? 'text-success' : description.kind === 'expense' ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      <Icon className={compact ? 'size-4' : 'size-5'} />
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

/** Mobile history row. */
export function MovementCard({ movement, lookups, onEdit, onDelete }: CardProps) {
  const description = describeMovement(movement, lookups);
  return (
    <li
      data-testid={`movement-${movement.id}`}
      data-kind={description.kind}
      className="flex items-center gap-3 rounded-lg border border-border bg-card py-2.5 pr-1 pl-3"
    >
      <IconTile description={description} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-body-md font-medium text-foreground">{description.title}</p>
          {description.bucketLabel && <Badge>{description.bucketLabel}</Badge>}
          <StateBadges description={description} />
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-label-mono-xs text-muted-foreground">
          <span>{subLine(description)}</span>
          <span aria-hidden="true">•</span>
          <time dateTime={movement.date.toISOString()}>{timeKey(movement.date)}</time>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <MovementAmount movement={movement} kind={description.kind} />
        {description.kind === 'transfer' && (
          <p className="max-w-28 truncate font-mono text-label-mono-xs text-muted-foreground">
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

const HEAD_CLASS = 'sticky top-0 z-10 whitespace-nowrap bg-card px-2 py-2 text-left font-mono text-label-mono-xs font-normal uppercase text-muted-foreground';

interface TableProps extends RowActions {
  movements: Movement[];
  lookups: MovementLookups;
  pendingIds: ReadonlySet<string>;
}

/** Desktop history table: hairline rows, sticky header, one row per movement. */
export function MovementTable({ movements, lookups, pendingIds, onEdit, onDelete }: TableProps) {
  return (
    <div className="max-h-[36rem] overflow-auto border-y border-border">
      <table className="w-full min-w-[48rem] border-collapse text-body-md" aria-label="Movimientos del mes">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={HEAD_CLASS}>Fecha y hora</th>
            <th scope="col" className={HEAD_CLASS}>Concepto</th>
            <th scope="col" className={HEAD_CLASS}>Categoría</th>
            <th scope="col" className={HEAD_CLASS}>Cuenta</th>
            <th scope="col" className={HEAD_CLASS}>Estado</th>
            <th scope="col" className={cn(HEAD_CLASS, 'text-right')}>Monto</th>
            <th scope="col" className={cn(HEAD_CLASS, 'w-12')}><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {movements.map(movement => {
            const description = describeMovement(movement, lookups);
            const pending = pendingIds.has(movement.id);
            const detail = description.kind === 'transfer'
              ? (description.hasDescription ? 'Transferencia' : null)
              : description.hasDescription ? description.subcategory : 'Sin descripción';
            return (
              <tr
                key={movement.id}
                data-testid={`movement-${movement.id}`}
                data-kind={description.kind}
                className="border-b border-border last:border-b-0 hover:bg-foreground/[0.03]"
              >
                <td className="whitespace-nowrap px-2 py-1.5 align-middle">
                  <time dateTime={movement.date.toISOString()} className="flex flex-col font-mono text-label-mono-sm leading-tight text-foreground">
                    <span>{formatShortDate(movement.date)}</span>
                    <span className="text-label-mono-xs text-muted-foreground">{timeKey(movement.date)}</span>
                  </time>
                </td>
                <td className="max-w-[13rem] px-2 py-1.5 align-middle">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconTile description={description} compact />
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight text-foreground">{description.title}</p>
                      {(detail || description.adjustment || description.shared) && (
                        <p className="flex items-center gap-1.5 font-mono text-label-mono-xs text-muted-foreground">
                          {detail && <span className="truncate">{detail}</span>}
                          <StateBadges description={description} />
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5 align-middle">
                  {description.kind === 'transfer' ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {description.category && <span className="max-w-[9rem] truncate text-foreground" title={description.category}>{description.category}</span>}
                      {description.kind === 'income' && <Badge variant="positive">Ingreso</Badge>}
                      {description.bucketLabel && <Badge>{description.bucketLabel}</Badge>}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5 align-middle text-muted-foreground">
                  {description.kind === 'transfer'
                    ? `${description.accountName ?? '—'} → ${description.toAccountName ?? '—'}`
                    : <span className="whitespace-nowrap">{description.accountName ?? '—'}</span>}
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <Badge
                    variant={pending ? 'warning' : 'positive'}
                    data-testid={`movement-sync-${movement.id}`}
                    title={pending ? 'Pendiente de sincronizar' : 'Sincronizado'}
                    aria-label={pending ? 'Pendiente de sincronizar' : 'Sincronizado'}
                  >
                    {pending ? 'Pendiente' : 'Sincronizado'}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right align-middle">
                  <MovementAmount movement={movement} kind={description.kind} />
                </td>
                <td className="px-1 py-0 align-middle">
                  {description.editable && (
                    <MovementRowMenu label={description.title} onEdit={() => onEdit(movement)} onDelete={() => onDelete(movement)} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
