'use client';

import React from 'react';
import { CalendarDays, Flag, ListChecks, PiggyBank, Plus, Target } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Goal, SavingsGoal } from '../../../core/domain/models/types';
import type { GoalCard, SavingsGoalCard } from '../../../core/use-cases/buildControlView';
import { GOAL_STATUS_LABEL, type GoalStatus } from '../../../core/use-cases/describeGoalStatus';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import { formatShortDate } from '../../../core/use-cases/formatMovementWhen';
import { EmptyState, SectionHeader } from './controlUi';
import ItemMenu from './ItemMenu';

interface Props {
  goals: GoalCard[];
  savingsGoals: SavingsGoalCard[];
  /** Active goals + open savings goals (the count shown in the header). */
  activeCount: number;
  onNew: () => void;
  onIncrement: (goal: Goal) => void;
  onToggleMilestone: (goal: Goal, milestoneId: string, done: boolean) => void;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goal: Goal) => void;
  onEditSavings: (goal: SavingsGoal) => void;
  onDeleteSavings: (goal: SavingsGoal) => void;
  /** "Asignar ahorro": a contribution is an expense tagged to the savings goal. */
  onAllocate: () => void;
}

const STATUS_VARIANT: Record<GoalStatus, 'positive' | 'warning' | 'neutral'> = {
  on_track: 'positive',
  behind: 'warning',
  no_deadline: 'neutral',
  completed: 'positive',
};

function GoalRow({ card, onIncrement, onToggleMilestone, onEdit, onDelete }: {
  card: GoalCard;
  onIncrement: Props['onIncrement'];
  onToggleMilestone: Props['onToggleMilestone'];
  onEdit: Props['onEditGoal'];
  onDelete: Props['onDeleteGoal'];
}) {
  const { goal, percent, detail } = card;
  return (
    <li className="rounded-lg bg-surface-2 p-4" data-testid={`goal-card-${goal.id}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-primary" aria-hidden="true">
          {goal.kind === 'numeric' ? <Target className="size-5" /> : <ListChecks className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-headline-sm text-foreground">{goal.name}</h4>
          {goal.description && <p className="text-body-md text-muted-foreground">{goal.description}</p>}
        </div>
        <span className="text-metric-num-md tabular-nums text-primary" data-testid={`goal-percent-${goal.id}`}>{percent}%</span>
        <ItemMenu label={goal.name} onEdit={() => onEdit(goal)} onDelete={() => onDelete(goal)} />
      </div>

      <Progress value={percent} aria-label={`Progreso de ${goal.name}`} className="mt-3" />

      {goal.kind === 'numeric' ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-label-mono-sm text-muted-foreground">{detail}</span>
          <Button variant="secondary" onClick={() => onIncrement(goal)} aria-label={`Sumar 1 a ${goal.name}`}>
            <Plus />
            1
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="font-mono text-label-mono-sm text-muted-foreground">{detail}</p>
          <ul className="mt-1">
            {(goal.milestones ?? []).map(milestone => (
              <li key={milestone.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body-md">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[hsl(var(--primary))]"
                    checked={milestone.done}
                    onChange={event => onToggleMilestone(goal, milestone.id, event.target.checked)}
                  />
                  <span className={cn('min-w-0 break-words', milestone.done && 'text-muted-foreground line-through')}>{milestone.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function SavingsRow({ card, onEdit, onDelete, onAllocate }: {
  card: SavingsGoalCard;
  onEdit: Props['onEditSavings'];
  onDelete: Props['onDeleteSavings'];
  onAllocate: Props['onAllocate'];
}) {
  const { goal, currentCents, percent, status } = card;
  return (
    <li className="rounded-lg bg-surface-2 p-4" data-testid={`savings-goal-card-${goal.id}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-primary" aria-hidden="true">
          <PiggyBank className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-headline-sm text-foreground">{goal.name}</h4>
          <p className="font-mono text-label-mono-xs uppercase text-muted-foreground">Meta de ahorro</p>
        </div>
        <span className="text-metric-num-md tabular-nums text-primary" data-testid={`savings-percent-${goal.id}`}>{percent}%</span>
        <ItemMenu label={goal.name} onEdit={() => onEdit(goal)} onDelete={() => onDelete(goal)} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-label-mono-sm">
        <span className="text-muted-foreground">Acumulado: <span className="text-foreground">{formatMoney(currentCents)}</span></span>
        <span className="text-muted-foreground">Objetivo: <span className="text-foreground">{formatMoney(goal.target_amount)}</span></span>
      </div>
      <Progress value={percent} aria-label={`Progreso de ${goal.name}`} className="mt-2" />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 font-mono text-label-mono-xs text-muted-foreground">
          {goal.deadline && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Cierre: {formatShortDate(goal.deadline)}
            </span>
          )}
          {status !== 'no_deadline' && <Badge variant={STATUS_VARIANT[status]}>{GOAL_STATUS_LABEL[status]}</Badge>}
        </span>
        {status !== 'completed' && (
          <Button variant="ghost" size="sm" onClick={onAllocate} className="text-primary">
            <Plus />
            Asignar ahorro
          </Button>
        )}
      </div>
    </li>
  );
}

/** "Metas activas": numeric/checklist goals and savings goals, each with its progress and actions. */
export default function GoalsPanel(props: Props) {
  const { goals, savingsGoals, activeCount, onNew } = props;
  const isEmpty = goals.length === 0 && savingsGoals.length === 0;
  return (
    <Panel aria-labelledby="control-goals-title" data-testid="goals-section">
      <SectionHeader
        titleId="control-goals-title"
        icon={<Flag />}
        title="Metas activas"
        subtitle="Visión estratégica"
        action={
          <>
            <span className="hidden font-mono text-label-mono-xs text-muted-foreground sm:inline">{activeCount} {activeCount === 1 ? 'activa' : 'activas'}</span>
            <Button variant="secondary" size="sm" onClick={onNew}>
              <Plus />
              Nueva meta
            </Button>
          </>
        }
      />
      <PanelBody className="flex flex-col gap-3">
        {isEmpty ? (
          <EmptyState action={<Button onClick={onNew}><Plus />Crear tu primera meta</Button>}>
            Todavía no tenés metas. Definí un objetivo numérico, una lista de hitos o una meta de ahorro.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map(card => (
              <GoalRow
                key={card.goal.id}
                card={card}
                onIncrement={props.onIncrement}
                onToggleMilestone={props.onToggleMilestone}
                onEdit={props.onEditGoal}
                onDelete={props.onDeleteGoal}
              />
            ))}
            {savingsGoals.map(card => (
              <SavingsRow key={card.goal.id} card={card} onEdit={props.onEditSavings} onDelete={props.onDeleteSavings} onAllocate={props.onAllocate} />
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
