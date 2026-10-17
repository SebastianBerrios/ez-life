'use client';

import React, { useMemo } from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { QuickRecordTab } from './QuickRecordSheet';
import type { FinancesTab } from './FinancesScreen';
import PersonalProgress from './PersonalProgress';
import HeroBalance from './dashboard/HeroBalance';
import BudgetPanel from './dashboard/BudgetPanel';
import FocusPanel from './dashboard/FocusPanel';
import PrimaryGoalCard from './dashboard/PrimaryGoalCard';
import LoansCard from './dashboard/LoansCard';
import RecentTransactions from './dashboard/RecentTransactions';
import SharedSpaceCard from './dashboard/SharedSpaceCard';
import { CapitalKpi, PerformanceKpi, RuleKpi } from './dashboard/DesktopKpis';
import type { FocusItem } from '../../core/use-cases/buildFocusToday';
import { useDashboardData } from '../hooks/useDashboardData';
import { useHideAmounts } from '../hooks/useHideAmounts';
import { useIsDesktop } from '../hooks/useMediaQuery';

export interface DashboardNavigateOptions {
  /** Finanzas sub-tab to land on. */
  financesTab?: FinancesTab;
}

interface Props {
  userId: string;
  /** Month shown (any date inside it); defaults to the current month. The shell owns the selector. */
  refDate?: Date;
  onOpenProgress?: () => void;
  /** Opens the app-level "Nuevo Registro" sheet (optionally on a given tab). */
  onOpenQuickRecord?: (tab?: QuickRecordTab) => void;
  /** Moves to another route of the shell (the Dashboard never imports the router). */
  onNavigate?: (route: string, options?: DashboardNavigateOptions) => void;
}

function cycleStateLabel(refDate: Date, now: Date): string {
  const shown = refDate.getFullYear() * 12 + refDate.getMonth();
  const current = now.getFullYear() * 12 + now.getMonth();
  if (shown === current) return 'Ciclo activo';
  return shown < current ? 'Ciclo cerrado' : 'Ciclo futuro';
}

function monthLabel(date: Date): string {
  return `${date.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '')} ${date.getFullYear()}`;
}

export default function Dashboard({ userId, refDate: refDateProp, onOpenProgress, onOpenQuickRecord, onNavigate }: Props) {
  const { loading, view, completeHabit, completeTask } = useDashboardData(userId, refDateProp);
  const { hidden, toggle } = useHideAmounts();
  const isDesktop = useIsDesktop();

  const refDate = refDateProp ?? view.today;
  const stateLabel = useMemo(() => cycleStateLabel(refDate, new Date()), [refDate]);

  const quickRecord = (tab: QuickRecordTab) => onOpenQuickRecord?.(tab);
  const go = (route: string, options?: DashboardNavigateOptions) => onNavigate?.(route, options);
  const toggleFocusItem = (item: FocusItem) => {
    if (item.done) return;
    void (item.kind === 'habit' ? completeHabit(item.id) : completeTask(item.id));
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] space-y-4" aria-busy="true" data-testid="dashboard-loading">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const focus = <FocusPanel items={view.focus} desktop={isDesktop} onToggle={toggleFocusItem} onSeeAll={() => go('control')} />;
  const goal = (
    <PrimaryGoalCard
      goal={view.primaryGoal}
      desktop={isDesktop}
      onContribute={() => quickRecord('expense')}
      onCreate={() => quickRecord('goal')}
    />
  );
  const loans = <LoansCard view={view} desktop={isDesktop} onOpenLoans={() => go('finances', { financesTab: 'loans' })} />;

  if (isDesktop) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6" data-testid="dashboard-desktop">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-label-mono-sm uppercase text-muted-foreground">
              Terminal de control / <span className="text-primary">{stateLabel}</span>
            </p>
            <h2 className="flex items-baseline gap-3 text-headline-lg text-foreground">
              Resumen Ejecutivo
              <span className="font-mono text-label-mono-sm font-normal uppercase text-muted-foreground">{monthLabel(refDate)}</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {view.savingsRate !== null && (
              <Badge variant="neutral" className="h-9 px-3" data-testid="savings-rate">
                Tasa de ahorro <span className="text-primary">{view.savingsRate}%</span>
              </Badge>
            )}
            <Button variant="secondary" onClick={() => quickRecord('transfer')}>
              <ArrowLeftRight />
              Transferir
            </Button>
            <Button onClick={() => quickRecord('expense')}>
              <Plus />
              Registrar Movimiento
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <CapitalKpi view={view} hidden={hidden} onToggleHidden={toggle} onQuickRecord={quickRecord} />
          <RuleKpi view={view} />
          <PerformanceKpi view={view} />
          {goal}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <BudgetPanel view={view} desktop />
            <RecentTransactions view={view} onSeeAll={() => go('finances')} />
          </div>
          <div className="space-y-6">
            {focus}
            <SharedSpaceCard view={view} onOpen={() => go('shared-space')} />
            {loans}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4" data-testid="dashboard-mobile">
      <h2 className="sr-only">Resumen del ciclo</h2>
      <HeroBalance view={view} hidden={hidden} onToggleHidden={toggle} onQuickRecord={quickRecord} onOpenGoals={() => go('control')} />
      <BudgetPanel view={view} desktop={false} />
      {focus}
      {goal}
      <PersonalProgress userId={userId} compact onOpen={onOpenProgress} />
      {loans}
    </motion.div>
  );
}
