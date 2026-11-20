'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuickRecordKind, QuickRecordTab } from './QuickRecordSheet';
import type { FinancesTab } from './FinancesScreen';
import type { RegistrationPrefill } from '../../core/use-cases/buildRegistrationPrefill';
import type { SetupChecklistKey } from '../../core/domain/models/types';
import { useSummaryData } from '../hooks/useSummaryData';
import { useHideAmounts } from '../hooks/useHideAmounts';
import BalanceHero from './summary/BalanceHero';
import PendingRegistrations from './summary/PendingRegistrations';
import AccountsAndDebts from './summary/AccountsAndDebts';
import CompactRuleView from './summary/CompactRule';
import PrimaryGoal from './summary/PrimaryGoal';
import SetupChecklistCard from './summary/SetupChecklistCard';

export interface DashboardNavigateOptions {
  /** Finanzas sub-tab to land on. */
  financesTab?: FinancesTab;
}

interface Props {
  userId: string;
  /** Month shown (any date inside it); defaults to the current month. The shell owns the selector. */
  refDate?: Date;
  /** Opens the app-level "Nuevo Registro" sheet (optionally on a given tab/kind). */
  onOpenQuickRecord?: (tab?: QuickRecordTab, kind?: QuickRecordKind) => void;
  /** Opens "Nuevo Registro" prefilled from a "Por registrar" item. */
  onRegisterPending?: (prefill: RegistrationPrefill) => void;
  /** Navigates to Settings and opens the edit form for a legacy credit card without credit_limit. */
  onAddCreditLimit?: (accountId: string) => void;
  /** Opens the corresponding onboarding step in settings mode from the setup checklist card. */
  onCompleteSetup?: (key: SetupChecklistKey) => void;
}

/**
 * Minimalist Summary ("Resumen", spec 013 FR-034, SC-009).
 *
 * Sections in strict order:
 * 1. Balance del mes (`BalanceHero`)
 * 2. Por registrar (`PendingRegistrations`, current month only)
 * 3. Cuentas y Deudas (`AccountsAndDebts`, stacked on mobile, side-by-side on desktop)
 * 4. 50/30/20 compacto (`CompactRuleView`)
 * 5. Meta de ahorro principal (`PrimaryGoal`)
 * 6. Checklist de configuración (mounted in US5)
 *
 * Fed exclusively by `useSummaryData`. Single centered column (~720 px) on desktop,
 * no KPI grid, and the shell's "+" button stays the sole primary CTA (FR-038).
 */
export default function Dashboard({
  userId,
  refDate: refDateProp,
  onOpenQuickRecord,
  onRegisterPending,
  onAddCreditLimit,
  onCompleteSetup,
}: Props) {
  const { loading, view, register, skip, dismissChecklist } = useSummaryData(userId, refDateProp);
  const { hidden, toggle } = useHideAmounts();
  const prefersReducedMotion = useReducedMotion();

  if (loading) {
    return (
      <div
        className="mx-auto min-h-[100dvh] w-full max-w-[720px] space-y-4"
        aria-busy="true"
        data-testid="dashboard-loading"
      >
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
      className="mx-auto w-full max-w-[720px] space-y-4 md:space-y-5"
      data-testid="summary-dashboard"
    >
      <h1 className="sr-only">Resumen</h1>

      {/* 1. Balance del mes */}
      <BalanceHero balance={view.balance} hidden={hidden} onToggleHidden={toggle} />

      {/* 2. Por registrar (solo mes en curso real) */}
      {view.isCurrentMonth && (
        <PendingRegistrations
          items={view.pending}
          hidden={hidden}
          onRegister={item => onRegisterPending?.(register(item))}
          onSkip={item => void skip(item)}
        />
      )}

      {/* 3. Cuentas y Deudas */}
      <AccountsAndDebts
        accounts={view.accounts}
        debts={view.debts}
        hidden={hidden}
        onAddCreditLimit={onAddCreditLimit}
      />

      {/* 4. 50/30/20 compacto */}
      <CompactRuleView rule={view.rule} hidden={hidden} />

      {/* 5. Meta de ahorro principal */}
      <PrimaryGoal
        goal={view.primaryGoal}
        hidden={hidden}
        onContribute={() => onOpenQuickRecord?.('expense')}
        onCreate={() => onOpenQuickRecord?.('goal', 'savings-goal')}
      />

      {/* 6. Checklist de configuración */}
      <SetupChecklistCard
        checklist={view.checklist}
        onOpenStep={key => onCompleteSetup?.(key)}
        onDismiss={() => void dismissChecklist()}
      />
    </motion.div>
  );
}
