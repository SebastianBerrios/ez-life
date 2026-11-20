'use client';

import React from 'react';
import { Target } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import { formatShortDate } from '../../../core/use-cases/formatMovementWhen';
import type { PrimarySavingsGoal } from '../../../core/use-cases/pickPrimarySavingsGoal';
import { SUMMARY_MASKED_AMOUNT } from './HideAmountsToggle';

interface Props {
  goal: PrimarySavingsGoal | null;
  hidden?: boolean;
  onContribute?: () => void;
  onCreate?: () => void;
}

function wholePercent(percentage: number): number {
  return Math.min(99, Math.max(0, Math.floor(percentage)));
}

/**
 * Section 5 of the minimalist Summary: primary savings goal (spec 013 FR-034).
 * Pure presentation; action buttons are secondary so "+" stays the sole primary CTA (FR-038).
 */
export default function PrimaryGoal({ goal, hidden = false, onContribute, onCreate }: Props) {
  const money = (cents: number) => (hidden ? SUMMARY_MASKED_AMOUNT : formatMoney(cents));

  if (!goal) {
    return (
      <Panel aria-label="Meta de ahorro" className="gap-3 p-5" data-testid="primary-goal-empty">
        <div className="flex items-center gap-2">
          <Target className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-fredoka text-lg font-semibold text-foreground">Meta de ahorro</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Aún no tienes una meta de ahorro activa. Crea una para seguir tu avance.
        </p>
        {onCreate && (
          <div>
            <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onCreate}>
              Crear meta
            </Button>
          </div>
        )}
      </Panel>
    );
  }

  const { goal: savingsGoal, currentAmountCents, percentage, remainingCents } = goal;
  const percent = wholePercent(percentage);

  return (
    <Panel aria-label="Meta de ahorro" className="gap-3 p-5" data-testid="primary-goal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Meta de ahorro</p>
          <h2 className="truncate font-fredoka text-lg font-semibold text-foreground">{savingsGoal.name}</h2>
        </div>
        {onContribute && (
          <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onContribute}>
            Aportar
          </Button>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{`${money(currentAmountCents)} de ${money(savingsGoal.target_amount)}`}</span>
        <span className="text-muted-foreground">{`${percent}%`}</span>
      </div>

      <Progress value={percent} aria-label={`Progreso de ${savingsGoal.name}`} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{`Faltan ${money(remainingCents)}`}</span>
        {savingsGoal.deadline && <span>{`Fecha límite ${formatShortDate(savingsGoal.deadline)}`}</span>}
      </div>
    </Panel>
  );
}
