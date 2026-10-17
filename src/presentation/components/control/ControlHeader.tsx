'use client';

import React from 'react';
import { Flame, Zap } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { RingProgress } from '@/components/ui/ring-progress';
import { cn } from '@/lib/utils';
import type { ControlView, ActiveStreak } from '../../../core/use-cases/buildControlView';
import type { DayPerformance } from '../../../core/use-cases/calculateWeeklyPerformance';
import { SCORE_STATE_LABEL, type ScoreState } from '../../../core/use-cases/describeScoreState';

const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const WEEKDAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MONTH_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATE_VARIANT: Record<ScoreState, 'positive' | 'warning' | 'neutral'> = {
  excelente: 'positive',
  en_ritmo: 'positive',
  atencion: 'warning',
};

function streakText({ streak, unit }: ActiveStreak): string {
  if (unit === 'weeks') return `${streak} ${streak === 1 ? 'semana' : 'semanas'}`;
  return `${streak} ${streak === 1 ? 'día' : 'días'}`;
}

function rangeLabel(start: Date, end: Date): string {
  return `${start.getDate()} - ${end.getDate()} ${MONTH_SHORT[end.getMonth()]}`;
}

function dayLabel(day: DayPerformance): string {
  const name = `${WEEKDAY_NAME[day.date.getDay()]} ${day.date.getDate()}`;
  if (day.isFuture) return day.scheduled > 0 ? `${name}: ${day.scheduled} ${day.scheduled === 1 ? 'programado' : 'programados'}` : `${name}: sin programación`;
  return day.scheduled > 0 ? `${name}: ${day.done} de ${day.scheduled} completados` : `${name}: sin programación`;
}

/** L M M J V S D strip of the current week; today highlighted, future days muted. */
export function WeekStrip({ days, desktop }: { days: DayPerformance[]; desktop: boolean }) {
  return (
    <ol aria-label="Semana actual" className={cn('grid grid-cols-7', desktop ? 'gap-2' : 'gap-1.5')}>
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
              'flex flex-col items-center justify-center rounded-lg border py-2',
              day.isToday ? 'border-primary/50 bg-primary/10' : 'border-transparent bg-surface-2',
              day.isFuture && !day.isToday && 'opacity-60',
            )}
          >
            <span aria-hidden="true" className={cn('font-mono text-label-mono-xs', day.isToday ? 'font-medium text-primary' : 'text-muted-foreground')}>
              {WEEKDAY_LETTER[day.date.getDay()]}
            </span>
            <span aria-hidden="true" className={cn('mt-0.5 text-body-md tabular-nums text-foreground', day.isToday && 'font-semibold')}>
              {day.date.getDate()}
            </span>
            {desktop ? (
              <span aria-hidden="true" className={cn('mt-1 font-mono text-label-mono-xs tabular-nums', complete ? 'text-success' : 'text-muted-foreground')}>
                {day.isFuture || day.scheduled === 0 ? '--' : `${day.done}/${day.scheduled}`}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={cn('mt-1.5 size-1.5 rounded-full', complete ? 'bg-primary' : hasData && day.done > 0 ? 'bg-primary/50' : 'bg-border-strong')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ScoreRing({ pct, size }: { pct: number | null; size: number }) {
  return (
    <RingProgress value={pct ?? 0} size={size} strokeWidth={size > 80 ? 8 : 5} aria-label="Puntaje diario">
      {size > 80 ? (
        <Zap className="size-6 text-primary" aria-hidden="true" />
      ) : (
        <span className="flex flex-col items-center leading-none">
          <span className="font-mono text-label-mono-xs font-medium text-primary">{pct === null ? '—' : `${pct}%`}</span>
          <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">SCORE</span>
        </span>
      )}
    </RingProgress>
  );
}

function StreakLine({ streak }: { streak: ActiveStreak | null }) {
  if (!streak) return null;
  return (
    <p className="flex items-center gap-2 text-body-md text-foreground" data-testid="active-streak">
      <Flame className="size-4 text-primary" aria-hidden="true" />
      <span>Racha activa: <strong className="font-semibold text-primary">{streakText(streak)}</strong></span>
    </p>
  );
}

function StateBadge({ state }: { state: ScoreState | null }) {
  if (!state) return null;
  return <Badge variant={STATE_VARIANT[state]}>{SCORE_STATE_LABEL[state]}</Badge>;
}

function scoreSentence(view: ControlView): string {
  if (!view.score.hasData) return 'Nada programado para hoy.';
  return `${view.score.done} de ${view.score.scheduled} objetivos de hoy completados`;
}

/** Mobile "Centro de mando": title, real score ring, active streak, derived state and the week strip. */
function MobileHeader({ view }: { view: ControlView }) {
  return (
    <Panel aria-label="Centro de mando" className="gap-4 p-5" data-testid="control-header">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Centro de mando</span>
          <h2 className="mt-0.5 text-headline-lg-mobile text-foreground">Control y Metas</h2>
          <p className="mt-1 text-body-sm text-muted-foreground" data-testid="score-sentence">{scoreSentence(view)}</p>
        </div>
        <ScoreRing pct={view.score.pct} size={64} />
      </div>
      {(view.activeStreak || view.scoreState) && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
          {view.activeStreak ? <StreakLine streak={view.activeStreak} /> : <span />}
          <StateBadge state={view.scoreState} />
        </div>
      )}
      <WeekStrip days={view.week.days} desktop={false} />
    </Panel>
  );
}

/** Desktop top row: Desempeño semanal, Efectividad diaria and Carga operativa. */
function DesktopHeader({ view }: { view: ControlView }) {
  const { week, score, load, today } = view;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr]" data-testid="control-header">
      <h2 className="sr-only">Control y Metas</h2>

      <Panel aria-label="Desempeño semanal" className="gap-4 p-5 md:col-span-2 xl:col-span-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-label-mono-sm uppercase text-foreground">Desempeño semanal</h3>
            <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-label-mono-xs text-muted-foreground">{rangeLabel(week.start, week.end)}</span>
          </div>
          {week.state && week.summary.pct !== null && (
            <Badge variant={STATE_VARIANT[week.state]}>{SCORE_STATE_LABEL[week.state]} ({week.summary.pct}%)</Badge>
          )}
        </div>
        <WeekStrip days={week.days} desktop />
      </Panel>

      <Panel aria-label="Efectividad diaria" className="gap-3 p-5">
        <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Efectividad diaria</span>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-display-hero-mobile tabular-nums text-foreground xl:text-display-hero" data-testid="daily-score">
              {score.pct === null ? '—' : `${score.pct}%`}
            </p>
            <p className="text-body-sm text-muted-foreground" data-testid="score-sentence">{scoreSentence(view)}</p>
          </div>
          <ScoreRing pct={score.pct} size={96} />
        </div>
        <StreakLine streak={view.activeStreak} />
        {view.scoreState && (
          <p className="flex items-center gap-2 font-mono text-label-mono-xs text-muted-foreground">
            Estado actual: <StateBadge state={view.scoreState} />
          </p>
        )}
      </Panel>

      <Panel aria-label="Carga operativa" className="gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Carga operativa</span>
          <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-label-mono-xs text-muted-foreground">
            {`${today.getDate()} ${MONTH_LABEL[today.getMonth()]}`}
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {[
            ['Hábitos', load.habitsToday, false],
            ['Urgentes', load.urgentTasks, load.urgentTasks > 0],
            ['Metas', load.activeGoals, false],
          ].map(([label, value, hot]) => (
            <div key={label as string} className="flex flex-col items-center rounded-lg bg-surface-2 px-2 py-3">
              <dd className={cn('text-metric-num-lg tabular-nums', hot ? 'text-expense' : 'text-primary')}>{value as number}</dd>
              <dt className="font-mono text-label-mono-xs uppercase text-muted-foreground">{label as string}</dt>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

export default function ControlHeader({ view, desktop }: { view: ControlView; desktop: boolean }) {
  return desktop ? <DesktopHeader view={view} /> : <MobileHeader view={view} />;
}
