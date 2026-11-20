'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BudgetStatus } from '../../../core/use-cases/budgetStatus';
import type { RuleBucket } from '../../../core/use-cases/buildRuleView';

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

/** Bar split by bucket percentage; each segment takes the color of its bucket's status. */
export function BucketBar({
  rows,
  className,
}: {
  rows: Pick<RuleBucket, 'id' | 'percentage' | 'status'>[];
  className?: string;
}) {
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
