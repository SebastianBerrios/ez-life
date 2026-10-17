'use client';

import React from 'react';
import { Flame, Minus, Plus, Wallet } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Money } from '@/components/ui/money';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { DashboardView } from '../../hooks/useDashboardData';
import type { QuickRecordTab } from '../QuickRecordSheet';
import { Amount, HideAmountsToggle } from './Amount';
import { BalanceDelta } from './HeroBalance';
import { BucketBar } from './BudgetPanel';
import Sparkline from './Sparkline';

const EYEBROW = 'font-mono text-label-mono-xs uppercase text-muted-foreground';
const MINI_BUTTON =
  'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-foreground/[0.03] text-body-md text-foreground outline-none transition-colors hover:border-border-strong hover:bg-foreground/[0.06] focus-visible:shadow-focus';

interface CapitalProps {
  view: DashboardView;
  hidden: boolean;
  onToggleHidden: () => void;
  onQuickRecord: (tab: QuickRecordTab) => void;
}

/** KPI 1: available capital (sum of account balances), the cycle's balance line and a real sparkline. */
export function CapitalKpi({ view, hidden, onToggleHidden, onQuickRecord }: CapitalProps) {
  const showSparkline = view.sparkline.daysWithData >= 2;
  return (
    <Panel aria-label="Capital disponible" className="gap-3 p-4" data-testid="kpi-capital">
      <div className="flex items-start justify-between gap-2">
        <span className={EYEBROW}>Capital disponible</span>
        <span className="-mr-2 -mt-2 flex items-center">
          <HideAmountsToggle hidden={hidden} onToggle={onToggleHidden} />
          <span className="flex size-8 items-center justify-center rounded-md bg-surface-2 text-primary" aria-hidden="true">
            <Wallet className="size-4" />
          </span>
        </span>
      </div>
      <div aria-live="polite" data-testid="kpi-capital-amount">
        <Amount cents={view.capitalCents} size="md" hidden={hidden} className="2xl:text-metric-num-lg" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-label-mono-xs text-muted-foreground">Balance del ciclo</span>
          <Amount cents={view.cycle.balance} sign="always" tone={hidden ? 'neutral' : 'auto'} size="sm" hidden={hidden} className="font-semibold" />
          <BalanceDelta view={view} hidden={hidden} />
        </div>
        {showSparkline && (
          <Sparkline points={view.sparkline.points} label="Evolución del balance del ciclo" width={96} height={32} className="shrink-0" />
        )}
      </div>
      <div className="mt-auto flex gap-2">
        <button type="button" className={MINI_BUTTON} onClick={() => onQuickRecord('income')}>
          <Plus className="size-4 text-primary" aria-hidden="true" /> Ingreso
        </button>
        <button type="button" className={MINI_BUTTON} onClick={() => onQuickRecord('expense')}>
          <Minus className="size-4 text-expense" aria-hidden="true" /> Gasto
        </button>
      </div>
    </Panel>
  );
}

/** KPI 2: total spent against the expected income, with the bucket split. */
export function RuleKpi({ view }: { view: DashboardView }) {
  const { budget } = view;
  const overall = budget.expectedIncome > 0 ? (budget.totalSpent / budget.expectedIncome) * 100 : 0;
  const available = Math.max(0, 100 - Math.round(overall));
  const remaining = budget.expectedIncome - budget.totalSpent;
  return (
    <Panel aria-label="Regla 50/30/20" className="gap-3 p-4" data-testid="kpi-rule">
      <div className="flex items-start justify-between gap-2">
        <span className={EYEBROW}>Regla 50 / 30 / 20</span>
        {budget.expectedIncome > 0 && <Badge variant="positive">{available}% disp.</Badge>}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-metric-num-md tabular-nums text-foreground">
        <Money cents={budget.totalSpent} size="md" />
        <span className="text-body-md text-muted-foreground">de {formatMoney(budget.expectedIncome)}</span>
      </p>
      {budget.hasBuckets ? (
        <>
          <BucketBar rows={budget.rows} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-label-mono-xs text-muted-foreground">
            {budget.rows.map(row => (
              <span key={row.id}>{row.percentage}% {row.name}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-body-sm text-muted-foreground">Sin categorías de distribución.</p>
      )}
      {budget.expectedIncome > 0 && (
        <div className="mt-auto flex items-baseline justify-between gap-2 font-mono text-label-mono-xs text-muted-foreground">
          <span>Consumo del ciclo</span>
          <span className="text-foreground">
            {remaining >= 0 ? `${formatMoney(remaining)} remanente` : `${formatMoney(-remaining, { sign: 'never' })} excedido`}
          </span>
        </div>
      )}
    </Panel>
  );
}

/** KPI 3: today's behavioral score (done / scheduled habits and tasks) and the next pending item. */
export function PerformanceKpi({ view }: { view: DashboardView }) {
  const { score, nextPending, focus } = view;
  const bestStreak = focus.reduce((best, item) => (item.kind === 'habit' && item.streakUnit === 'days' ? Math.max(best, item.streak ?? 0) : best), 0);
  return (
    <Panel aria-label="Rendimiento conductual" className="gap-3 p-4" data-testid="kpi-performance">
      <div className="flex items-start justify-between gap-2">
        <span className={EYEBROW}>Rendimiento conductual</span>
        {bestStreak > 0 && (
          <Badge variant="positive">
            <Flame aria-hidden="true" />
            {bestStreak} d racha
          </Badge>
        )}
      </div>
      {score.hasData ? (
        <>
          <p className="flex items-baseline gap-2 tabular-nums">
            <span className="text-metric-num-lg text-foreground" data-testid="score-pct">{score.pct}%</span>
            <span className="text-body-md text-muted-foreground">Score de hoy</span>
          </p>
          <div className="flex items-center gap-3">
            <Progress value={score.pct ?? 0} className="flex-1" aria-label="Avance de hoy" />
            <span className="font-mono text-label-mono-sm text-muted-foreground">{score.done}/{score.scheduled}</span>
          </div>
        </>
      ) : (
        <p className="text-body-md text-muted-foreground">Nada programado para hoy</p>
      )}
      {nextPending && (
        <p className="mt-auto truncate font-mono text-label-mono-xs text-muted-foreground">
          Siguiente: <span className="text-foreground">{nextPending.title}</span>
        </p>
      )}
    </Panel>
  );
}
