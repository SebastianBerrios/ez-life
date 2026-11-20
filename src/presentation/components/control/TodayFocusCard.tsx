'use client';

import React from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ControlView } from '../../../core/use-cases/buildControlView';
import { CheckButton } from './controlUi';

interface Props {
  view: ControlView;
  onCompleteHabit: (habitId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

/**
 * "Foco de Hoy": surfaces today's scheduled habits and overdue/today tasks at the top of Control
 * without collapsing domain entities (Principle XIII — habits and tasks keep separate lists & actions).
 */
export default function TodayFocusCard({ view, onCompleteHabit, onCompleteTask }: Props) {
  const todayHabits = view.habits.filter((h) => h.scheduledToday);
  const todayTasks = view.tasks.today;
  const pendingHabits = todayHabits.filter((h) => !h.doneToday);
  const pendingTasks = todayTasks.filter((t) => t.task.status !== 'done');
  const totalItems = todayHabits.length + todayTasks.length;
  const allDone = totalItems === 0 || (pendingHabits.length === 0 && pendingTasks.length === 0);

  return (
    <Panel aria-labelledby="today-focus-title" data-testid="today-focus-card" className="gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          <h3 id="today-focus-title" className="font-fredoka text-headline-md text-foreground">
            Foco de Hoy
          </h3>
        </div>
        {!allDone && (
          <Badge variant="neutral">
            {pendingHabits.length + pendingTasks.length} pendientes
          </Badge>
        )}
      </div>

      {allDone ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
          <span>Todo listo por hoy. Tómate un respiro o revisa tus listas debajo.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {todayHabits.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-medium text-muted-foreground">Hábitos de hoy</p>
              <ul className="flex flex-col gap-1.5">
                {todayHabits.map((card) => (
                  <li
                    key={card.habit.id}
                    className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-3 py-2"
                  >
                    <CheckButton
                      done={card.doneToday}
                      label={`Completar hábito "${card.habit.name}"`}
                      onToggle={() => onCompleteHabit(card.habit.id)}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-medium text-foreground',
                        card.doneToday && 'text-muted-foreground line-through',
                      )}
                    >
                      {card.habit.icon ? `${card.habit.icon} ${card.habit.name}` : card.habit.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-medium text-muted-foreground">Tareas para hoy</p>
              <ul className="flex flex-col gap-1.5">
                {todayTasks.map((item) => {
                  const done = item.task.status === 'done';
                  return (
                    <li
                      key={item.task.id}
                      className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-3 py-2"
                    >
                      <CheckButton
                        done={done}
                        label={`Completar tarea "${item.task.title}"`}
                        onToggle={() => onCompleteTask(item.task.id)}
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm font-medium text-foreground',
                          done && 'text-muted-foreground line-through',
                        )}
                      >
                        {item.task.title}
                      </span>
                      {item.overdue && !done && <Badge variant="negative">Vencida</Badge>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
