'use client';

import React from 'react';
import { PieChart } from 'lucide-react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { BudgetStatus } from '../../../core/use-cases/budgetStatus';
import type { BudgetRow, DashboardView } from '../../hooks/useDashboardData';
import { Amount } from './Amount';
import { cn } from '@/lib/utils';

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: 'Dentro del límite',
  warning: 'Cerca del límite',
  over: 'Presupuesto excedido',
};

export const STATUS_DOT_CLASS: Record<BudgetStatus, string> = {
  ok: 'bg-primary',
  warning: 'bg-warning',
  over: 'bg-expense',
};

const STATUS_SEGMENT_CLASS: Record<BudgetStatus, string> = {
  ok: 'bg-primary',
  warning: 'bg-warning',
  over: 'bg-expense',
};

export const STATUS_PROGRESS_CLASS: Record<BudgetStatus, string> = {
  ok: '[&_[data-slot=progress-indicator]]:bg-primary',
  warning: '[&_[data-slot=progress-indicator]]:bg-warning',
  over: '[&_[data-slot=progress-indicator]]:bg-expense',
};

/** Whole-number percent of a bucket's budget consumed (0 when the budget is 0). */
export function consumedPercent(row: BudgetRow): number {
  return Math.round(row.progress);
}

/** Bar split by bucket percentage; each segment takes the color of its bucket's status. */
export function BucketBar({ rows, className }: { rows: Pick<BudgetRow, 'id' | 'percentage' | 'status'>[]; className?: string }) {
  return (
    <div className={cn('flex h-1.5 w-full gap-0.5', className)} data-testid="bucket-bar">
      {rows.map(row => (
        <div
          key={row.id}
          className={cn('h-full rounded-sm', STATUS_SEGMENT_CLASS[row.status])}
          style={{ width: `${row.percentage}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function BudgetRowView({ row, desktop }: { row: BudgetRow; desktop: boolean }) {
  const remaining = row.budget - row.spent;
  const consumed = consumedPercent(row);
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] p-3" data-testid={`budget-row-${row.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            data-testid={`budget-status-${row.id}`}
            aria-label={STATUS_LABEL[row.status]}
            role="status"
            className={cn('mt-1.5 inline-block size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[row.status])}
          />
          <div className="min-w-0">
            <p className="text-body-md font-medium text-foreground">
              {row.name} <span className="font-mono text-label-mono-sm text-muted-foreground">({row.percentage}%)</span>
            </p>
            {row.categoryNames !== '' && (
              <p className="truncate font-mono text-label-mono-xs text-muted-foreground">{row.categoryNames}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-label-mono-sm text-foreground">
            <Amount cents={row.spent} size="sm" className="font-semibold" />
            {desktop && <span className="text-muted-foreground"> / {formatMoney(row.budget)}</span>}
          </p>
          {!desktop && (
            <p className="font-mono text-label-mono-xs text-muted-foreground">
              {consumed}% de {formatMoney(row.budget)}
            </p>
          )}
        </div>
      </div>

      <Progress value={Math.min(row.progress, 100)} className={STATUS_PROGRESS_CLASS[row.status]} aria-label={`Consumo de ${row.name}`} />

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-mono text-label-mono-xs text-muted-foreground">
        <span>
          {remaining >= 0 ? `Disponible: ${formatMoney(remaining)}` : `Excedido por ${formatMoney(-remaining, { sign: 'never' })}`}
        </span>
        <span className="flex items-center gap-2">
          {desktop && row.status === 'over' && <Badge variant="negative">¡Presupuesto excedido!</Badge>}
          {desktop && row.status === 'warning' && <Badge variant="warning">Cerca del límite de presupuesto</Badge>}
          <span>{consumed}% consumido</span>
        </span>
      </div>
    </li>
  );
}

interface Props {
  view: DashboardView;
  desktop: boolean;
}

/** Presupuesto 50/30/20: spent vs budget per bucket with the 3-level semaphore. */
export default function BudgetPanel({ view, desktop }: Props) {
  const { budget } = view;
  const worst: BudgetStatus = budget.rows.some(r => r.status === 'over') ? 'over' : budget.rows.some(r => r.status === 'warning') ? 'warning' : 'ok';
  const summary = `${formatMoney(budget.totalSpent)} / ${formatMoney(budget.totalBudget)}`;

  return (
    <Panel aria-label="Presupuesto 50/30/20" data-testid="budget-panel">
      {desktop ? (
        <PanelHeader
          eyebrow="Distribución presupuestaria"
          title="Regla inteligente 50/30/20"
          titleAs="h3"
          action={
            budget.hasBuckets ? (
              <span className="flex items-center gap-1.5 font-mono text-label-mono-xs text-muted-foreground">
                <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[worst])} aria-hidden="true" />
                {worst === 'ok' ? 'En parámetro óptimo' : STATUS_LABEL[worst]}
              </span>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-5 pb-3">
          <h3 className="flex items-center gap-2 whitespace-nowrap text-headline-md text-foreground">
            <PieChart className="size-5 text-primary" aria-hidden="true" />
            Presupuesto 50/30/20
          </h3>
          {budget.hasBuckets && <span className="font-mono text-label-mono-sm text-muted-foreground">{summary}</span>}
        </div>
      )}
      <PanelBody className="flex flex-col gap-4">
        {!budget.hasBuckets ? (
          <p className="text-body-md text-muted-foreground">No hay categorías de distribución configuradas todavía.</p>
        ) : (
          <>
            {!desktop && (
              <div className="flex flex-col gap-1.5">
                <BucketBar rows={budget.rows} />
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 font-mono text-label-mono-xs text-muted-foreground">
                  {budget.rows.map(row => (
                    <span key={row.id}>{row.percentage}% {row.name}</span>
                  ))}
                </div>
              </div>
            )}
            {budget.expectedIncome === 0 && (
              <p className="text-body-sm text-muted-foreground">
                Sin ingreso esperado configurado: cada presupuesto es {formatMoney(0)}. Defínelo en Ajustes.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {budget.rows.map(row => (
                <BudgetRowView key={row.id} row={row} desktop={desktop} />
              ))}
            </ul>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
