'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Landmark, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Money } from '@/components/ui/money';
import { formatMoney } from '../../../core/use-cases/formatMoney';
import type { FinancesKpis as Kpis } from '../../../core/use-cases/buildFinancesKpis';

interface Props {
  kpis: Kpis;
  /** Number of income movements of the month (hint of the income card). */
  incomeCount: number;
  /** Budget base the expense percentage refers to (sum of the bucket budgets). */
  budgetBase: number;
}

const MONEY_CLASS = '2xl:text-metric-num-lg';

function savingsHint(kpis: Kpis): string {
  if (kpis.savingsRate === null) return 'Sin ingresos este mes';
  if (kpis.savingsStatus === 'met') return 'Meta de ahorro alcanzada';
  if (kpis.savingsStatus === 'below') return 'Por debajo de la meta de ahorro';
  return 'Sin meta de ahorro definida';
}

/** The four KPI cards of Finanzas (2x2 on phones, one row on desktop). Transfers never count in any of them. */
export default function FinancesKpis({ kpis, incomeCount, budgetBase }: Props) {
  return (
    <section aria-label="Indicadores del mes" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4" data-testid="finances-kpis">
      <StatCard
        data-testid="kpi-income"
        label="Ingresos totales (mes)"
        icon={<ArrowDown aria-hidden="true" />}
        tone="positive"
        value={<Money cents={kpis.income} size="md" className={MONEY_CLASS} />}
        hint={incomeCount === 1 ? '1 ingreso registrado' : `${incomeCount} ingresos registrados`}
      />
      <StatCard
        data-testid="kpi-expense"
        label="Gastos acumulados"
        icon={<ArrowUp aria-hidden="true" />}
        value={<Money cents={kpis.expense} size="md" className={MONEY_CLASS} />}
        hint={kpis.expensePercentOfBudget === null
          ? 'Sin presupuesto base configurado'
          : `${kpis.expensePercentOfBudget}% del presupuesto base (${formatMoney(budgetBase)})`}
      />
      <StatCard
        data-testid="kpi-savings"
        label="Tasa neta de ahorro"
        icon={<TrendingUp aria-hidden="true" />}
        tone={kpis.savingsRate === null ? 'default' : kpis.savingsRate < 0 ? 'negative' : 'positive'}
        value={
          <span className="inline-flex flex-wrap items-baseline gap-x-2">
            <span className={MONEY_CLASS}>{kpis.savingsRate === null ? '—' : `${kpis.savingsRate}%`}</span>
            {kpis.savingsTargetPercent !== null && (
              <span className="font-mono text-label-mono-sm font-normal text-muted-foreground">obj. {kpis.savingsTargetPercent}%</span>
            )}
          </span>
        }
        hint={savingsHint(kpis)}
      />
      <StatCard
        data-testid="kpi-capital"
        label="Capital libre disponible"
        icon={<Landmark aria-hidden="true" />}
        value={<Money cents={kpis.capital} size="md" className={MONEY_CLASS} />}
        hint={kpis.accountCount === 1 ? '1 cuenta' : `${kpis.accountCount} cuentas`}
      />
    </section>
  );
}
