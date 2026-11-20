'use client';

import React from 'react';
import { Flame } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { RingProgress } from '@/components/ui/ring-progress';
import { cn } from '@/lib/utils';
import type { ControlView, ActiveStreak } from '../../../core/use-cases/buildControlView';
import type { DayPerformance } from '../../../core/use-cases/calculateWeeklyPerformance';
import { SCORE_STATE_LABEL, type ScoreState } from '../../../core/use-cases/describeScoreState';

const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const WEEKDAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const STATE_VARIANT: Record<ScoreState, 'positive' | 'warning' | 'neutral'> = {
  excelente: 'positive',
  en_ritmo: 'positive',
  atencion: 'warning',
};

function streakText({ streak, unit }: ActiveStreak): string {
  if (unit === 'weeks') return `${streak} ${streak === 1 ? 'semana' : 'semanas'}`;
  return `${streak} ${streak === 1 ? 'día' : 'días'}`;
}

function dayLabel(day: DayPerformance): string {
  const name = `${WEEKDAY_NAME[day.date.getDay()]} ${day.date.getDate()}`;
  if (day.isFuture) return day.scheduled > 0 ? `${name}: ${day.scheduled} ${day.scheduled === 1 ? 'programado' : 'programados'}` : `${name}: sin programación`;
  return day.scheduled > 0 ? `${name}: ${day.done} de ${day.scheduled} completados` : `${name}: sin programación`;
}

/** L M M J V S D strip of the current week; today highlighted, future days muted. */
export function WeekStrip({ days }: { days: DayPerformance[] }) {
  return (
    <ol aria-label="Semana actual" className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map(day => {
        const hasData = !day.isFuture && day.scheduled > 0;
        const complete = hasData && day.done === day.scheduled;
        return (
          <li
            key={day.date.getTime()}
            aria-label={dayLabel(day)}
            aria-current={day.isToday ? 'date' : undefined}
            data-testid={`week-day-${day.date.getDate()}`}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl py-2',
              day.isToday ? 'bg-primary/20 ring-1 ring-primary/50' : 'bg-surface-2/70',
              day.isFuture && !day.isToday && 'opacity-60',
            )}
          >
            <span aria-hidden="true" className={cn('text-xs', day.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {WEEKDAY_LETTER[day.date.getDay()]}
            </span>
            <span aria-hidden="true" className={cn('mt-0.5 text-sm tabular-nums text-foreground', day.isToday && 'font-semibold')}>
              {day.date.getDate()}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.5 size-1.5 rounded-full',
                complete ? 'bg-primary' : hasData && day.done > 0 ? 'bg-primary/50' : 'bg-border-strong',
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

function scoreSentence(view: ControlView): string {
  if (!view.score.hasData) return 'Nada programado para hoy.';
  return `${view.score.done} de ${view.score.scheduled} objetivos de hoy completados`;
}

export default function ControlHeader({ view }: { view: ControlView }) {
  const { score, activeStreak, scoreState, week } = view;
  return (
    <Panel aria-label="Avance de hoy" className="gap-4 p-5" data-testid="control-header">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="font-fredoka text-headline-lg-mobile md:text-headline-lg text-foreground">
            Control y hábitos
          </h2>
          <p className="font-fredoka text-display-hero-mobile tabular-nums text-foreground" data-testid="daily-score">
            {score.pct === null ? '—' : `${score.pct}%`}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="score-sentence">
            {scoreSentence(view)}
          </p>
        </div>
        <RingProgress value={score.pct ?? 0} size={76} strokeWidth={7} aria-label="Puntaje diario">
          <span className="font-fredoka text-sm font-semibold tabular-nums text-foreground">
            {score.pct === null ? '—' : `${score.pct}%`}
          </span>
        </RingProgress>
      </div>

      {(activeStreak || scoreState) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2/70 px-3.5 py-2.5">
          {activeStreak ? (
            <p className="flex items-center gap-2 text-sm text-foreground" data-testid="active-streak">
              <Flame className="size-4 text-primary" aria-hidden="true" />
              <span>Racha activa: <strong className="font-semibold">{streakText(activeStreak)}</strong></span>
            </p>
          ) : <span />}
          {scoreState && <Badge variant={STATE_VARIANT[scoreState]}>{SCORE_STATE_LABEL[scoreState]}</Badge>}
        </div>
      )}

      <WeekStrip days={week.days} />
    </Panel>
  );
}
