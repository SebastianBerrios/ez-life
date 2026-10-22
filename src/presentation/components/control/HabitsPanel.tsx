'use client';

import React from 'react';
import { Flame, Plus, Repeat } from 'lucide-react';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HabitCard } from '../../../core/use-cases/buildControlView';
import type { Habit } from '../../../core/domain/models/types';
import { CheckButton, EmptyState, SectionHeader } from './controlUi';
import ItemMenu from './ItemMenu';

interface Props {
  cards: HabitCard[];
  /** Average 30-day adherence (integer percent) or `null` when nothing is measurable yet. */
  adherence: number | null;
  onComplete: (habitId: string) => void;
  onNew: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

const STATUS_TEXT = { done: 'Hoy completado', pending: 'Pendiente hoy', off: 'No toca hoy' } as const;

function streakChip(card: HabitCard): string | null {
  if (card.streak <= 0) return null;
  return `Racha ${card.streak} ${card.streakUnit === 'weeks' ? 'sem' : 'd'}`;
}

/** 7 segments (oldest first, today last): done = primary, scheduled-and-missed = surface, off = faint. */
function SevenDayBar({ card }: { card: HabitCard }) {
  const done = card.last7.filter(cell => cell.done).length;
  const scheduled = card.last7.filter(cell => cell.scheduled).length;
  return (
    <div
      role="img"
      aria-label={`Últimos 7 días: ${done} de ${scheduled} ${scheduled === 1 ? 'día programado cumplido' : 'días programados cumplidos'}`}
      className="flex items-center gap-1.5"
      data-testid={`habit-week-${card.habit.id}`}
    >
      {card.last7.map((cell, index) => (
        <span
          key={cell.date.getTime()}
          data-state={cell.done ? 'done' : cell.scheduled ? 'missed' : 'off'}
          className={cn(
            'h-2 w-5 rounded-sm',
            cell.done ? 'bg-primary' : cell.scheduled ? 'bg-surface-3' : 'bg-foreground/[0.05]',
            index === 6 && !cell.done && 'ring-1 ring-border-strong',
          )}
        />
      ))}
    </div>
  );
}

function HabitRow({ card, onComplete, onEdit, onDelete }: { card: HabitCard } & Pick<Props, 'onComplete' | 'onEdit' | 'onDelete'>) {
  const { habit } = card;
  const chip = streakChip(card);
  return (
    <li className="rounded-lg bg-surface-2 p-3" data-testid={`habit-card-${habit.id}`} data-status={card.status}>
      <div className="flex items-start gap-3">
        <CheckButton
          done={card.doneToday}
          label={`Marcar "${habit.name}" como cumplido`}
          onToggle={() => onComplete(habit.id)}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn('break-words text-body-lg font-medium text-foreground', card.doneToday && 'text-muted-foreground line-through')}>
            {habit.icon ? `${habit.icon} ${habit.name}` : habit.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-label-mono-xs text-muted-foreground">{card.scheduleText}</span>
            {chip && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-label-mono-xs text-primary">
                <Flame className="size-3" aria-hidden="true" />
                {chip}
              </span>
            )}
          </div>
        </div>
        <ItemMenu label={habit.name} onEdit={() => onEdit(habit)} onDelete={() => onDelete(habit)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-14">
        <SevenDayBar card={card} />
        <span className={cn('font-mono text-label-mono-xs', card.doneToday ? 'text-primary' : 'text-muted-foreground')}>
          {STATUS_TEXT[card.status]}
          {card.tokensAvailable > 0 && <span className="ml-2 text-muted-foreground">· Comodines {card.tokensAvailable}</span>}
        </span>
      </div>
    </li>
  );
}

/** "Hábitos diarios": one card per habit with check, streak, 7-day bar and the adherence rate. */
export default function HabitsPanel({ cards, adherence, onComplete, onNew, onEdit, onDelete }: Props) {
  return (
    <Panel aria-labelledby="control-habits-title" data-testid="habits-section">
      <SectionHeader
        titleId="control-habits-title"
        icon={<Repeat />}
        title="Hábitos diarios"
        subtitle="Cadencia constante de ejecución"
        action={
          <Button variant="secondary" size="sm" onClick={onNew}>
            <Plus />
            Nuevo
          </Button>
        }
      />
      <PanelBody className="flex flex-col gap-3">
        {cards.length === 0 ? (
          <EmptyState action={<Button onClick={onNew}><Plus />Crear tu primer hábito</Button>}>
            Todavía no tienes hábitos. Un hábito te ayuda a sostener una rutina día a día.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {cards.map(card => (
              <HabitRow key={card.habit.id} card={card} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        )}
        {adherence !== null && (
          <p className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-label-mono-xs text-muted-foreground" data-testid="adherence">
            <span>Tasa de adherencia (30 días)</span>
            <span className="text-body-md font-medium tabular-nums text-primary">{adherence}%</span>
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}
