'use client';

import React from 'react';
import { ArrowLeftRight, Flag, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { DashboardView } from '../../hooks/useDashboardData';
import type { QuickRecordTab } from '../QuickRecordSheet';
import { Amount, HideAmountsToggle } from './Amount';

interface Props {
  view: DashboardView;
  hidden: boolean;
  onToggleHidden: () => void;
  onQuickRecord: (tab: QuickRecordTab) => void;
  onOpenGoals: () => void;
}

const ACTION_CLASS =
  'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-foreground/[0.03] px-1 py-2 font-mono text-label-mono-sm uppercase text-muted-foreground outline-none transition-colors hover:border-border-strong hover:bg-foreground/[0.06] hover:text-foreground focus-visible:shadow-focus';

/** Delta of the cycle balance against the previous cycle (null previous = nothing to compare). */
export function BalanceDelta({ view, hidden }: { view: DashboardView; hidden: boolean }) {
  const delta = view.comparison.delta?.balance;
  if (delta === undefined) {
    return <span className="text-body-sm text-muted-foreground">Sin datos del mes anterior para comparar</span>;
  }
  const variant = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  const Icon = delta < 0 ? TrendingDown : TrendingUp;
  return (
    <span className="flex flex-wrap items-center gap-2" data-testid="balance-delta">
      <Badge variant={variant}>
        <Icon aria-hidden="true" />
        {hidden ? '••••' : formatMoney(delta, { sign: 'always' })}
      </Badge>
      <span className="text-body-sm text-muted-foreground">vs mes anterior</span>
    </span>
  );
}

/** Mobile hero: balance of the cycle with its delta, available capital and the four quick actions. */
export default function HeroBalance({ view, hidden, onToggleHidden, onQuickRecord, onOpenGoals }: Props) {
  const { balance } = view.cycle;
  return (
    <Panel aria-label="Balance del ciclo" className="gap-4 p-5" data-testid="hero-balance">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-label-mono-xs uppercase text-muted-foreground">Balance del ciclo</span>
        <HideAmountsToggle hidden={hidden} onToggle={onToggleHidden} className="-my-2 -mr-2" />
      </div>

      <div className="flex flex-col gap-2">
        <div aria-live="polite" data-testid="hero-amount">
          <Amount cents={balance} size="lg" hidden={hidden} className="text-display-hero-mobile" tone={balance < 0 ? 'expense' : 'neutral'} />
        </div>
        <BalanceDelta view={view} hidden={hidden} />
      </div>

      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
        <span className="text-body-sm text-muted-foreground">Capital disponible</span>
        <Amount cents={view.capitalCents} size="sm" hidden={hidden} className="font-medium" data-testid="hero-capital" />
      </div>

      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Acciones rápidas">
        <button type="button" className={ACTION_CLASS} onClick={() => onQuickRecord('income')}>
          <Plus className="size-5 text-primary" aria-hidden="true" />
          Ingreso
        </button>
        <button type="button" className={ACTION_CLASS} onClick={() => onQuickRecord('expense')}>
          <Minus className="size-5 text-expense" aria-hidden="true" />
          Gasto
        </button>
        <button type="button" className={ACTION_CLASS} onClick={() => onQuickRecord('transfer')}>
          <ArrowLeftRight className="size-5" aria-hidden="true" />
          Mover
        </button>
        <button type="button" className={ACTION_CLASS} onClick={onOpenGoals}>
          <Flag className="size-5" aria-hidden="true" />
          Metas
        </button>
      </div>
    </Panel>
  );
}
