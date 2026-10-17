'use client';

import React from 'react';
import { ArrowRight, Target } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import { formatShortDate } from '../../../core/use-cases/formatMovementWhen';
import type { PrimarySavingsGoal } from '../../../core/use-cases/pickPrimarySavingsGoal';

interface Props {
  goal: PrimarySavingsGoal | null;
  desktop: boolean;
  /** "Aportar": opens the quick-record sheet on the expense tab (a savings contribution is an expense tagged to the goal). */
  onContribute: () => void;
  /** Desktop only: no active goal -> invite to create one instead of leaving a hole in the KPI row. */
  onCreate?: () => void;
}

/** Whole percent, never rounded up to 100 while the goal is still open. */
function wholePercent(percentage: number): number {
  return Math.min(99, Math.max(0, Math.floor(percentage)));
}

/** "Meta principal": the active savings goal with the most progress. Mobile panel / desktop KPI. */
export default function PrimaryGoalCard({ goal, desktop, onContribute, onCreate }: Props) {
  if (!goal) {
    if (!desktop) return null;
    return (
      <Panel aria-label="Meta principal" className="gap-2 p-4" data-testid="primary-goal-empty">
        <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Meta principal</span>
        <p className="text-body-md text-muted-foreground">Sin meta de ahorro activa</p>
        {onCreate && (
          <Button variant="outline" onClick={onCreate} className="mt-auto self-start">
            Crear meta
          </Button>
        )}
      </Panel>
    );
  }

  const { goal: savingsGoal, currentAmountCents, percentage, remainingCents } = goal;
  const percent = wholePercent(percentage);

  if (desktop) {
    return (
      <Panel aria-label="Meta principal" className="gap-3 p-4" data-testid="primary-goal">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Meta principal</span>
            <h3 className="truncate text-headline-md text-foreground">{savingsGoal.name}</h3>
          </div>
          <Button variant="secondary" onClick={onContribute}>
            Aportar
          </Button>
        </div>
        <div className="flex items-baseline justify-between gap-2 font-mono text-label-mono-sm">
          <span className="text-primary">{formatMoney(currentAmountCents)}</span>
          <span className="text-muted-foreground">Meta: {formatMoney(savingsGoal.target_amount)}</span>
        </div>
        <Progress value={percent} aria-label={`Progreso de ${savingsGoal.name}`} />
        <div className="flex items-center justify-between gap-2 font-mono text-label-mono-xs text-muted-foreground">
          <span>Faltan {formatMoney(remainingCents)}</span>
          {savingsGoal.deadline ? <span>Fecha límite {formatShortDate(savingsGoal.deadline)}</span> : <span>{percent}%</span>}
        </div>
      </Panel>
    );
  }

  return (
    <Panel aria-label="Meta principal" data-testid="primary-goal">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-5 pb-3">
        <h3 className="flex min-w-0 items-center gap-2 text-headline-md text-foreground">
          <Target className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="break-words">Meta: {savingsGoal.name}</span>
        </h3>
        <Badge variant="neutral" className="shrink-0">
          Objetivo {formatMoney(savingsGoal.target_amount)}
        </Badge>
      </div>
      <PanelBody className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2 font-mono text-label-mono-sm">
          <span className="text-primary">{formatMoney(currentAmountCents)} acumulado</span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} aria-label={`Progreso de ${savingsGoal.name}`} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-md text-muted-foreground">Faltan {formatMoney(remainingCents)}</span>
          <button
            type="button"
            onClick={onContribute}
            className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 font-mono text-label-mono-sm text-primary outline-none hover:bg-surface-3 focus-visible:shadow-focus"
          >
            Aportar
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        {savingsGoal.deadline && (
          <p className="font-mono text-label-mono-xs text-muted-foreground">Fecha límite {formatShortDate(savingsGoal.deadline)}</p>
        )}
      </PanelBody>
    </Panel>
  );
}
