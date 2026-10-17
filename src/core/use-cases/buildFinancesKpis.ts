import type { DistributionCategory } from '../domain/models/types';
import { calculateSavingsRate } from './calculateSavingsRate';

export type SavingsStatus = 'met' | 'below' | 'unknown';

export interface FinancesKpis {
  /** Cents; transfers never count. */
  income: number;
  expense: number;
  /** income - expense of the cycle. */
  netBalance: number;
  /** Whole-number percent of the budget base spent in the cycle (all expenses); null without a budget base. */
  expensePercentOfBudget: number | null;
  /** Whole-number percent of the income that was spent; null without income. */
  spentPercentOfIncome: number | null;
  savingsRate: number | null;
  /** Share of the savings distribution category(ies), when the user has one. */
  savingsTargetPercent: number | null;
  savingsStatus: SavingsStatus;
  capital: number;
  accountCount: number;
}

interface Input {
  income: number;
  expense: number;
  /** Sum of the bucket budgets (expected income). */
  budgetBase: number;
  distributionCategories: DistributionCategory[];
  capital: number;
  accountCount: number;
}

/** Numbers behind the four KPI cards of Finanzas. Pure: everything comes from the caller's real data. */
export function buildFinancesKpis({ income, expense, budgetBase, distributionCategories, capital, accountCount }: Input): FinancesKpis {
  const savingsRate = calculateSavingsRate(income, expense);
  const savingsBuckets = distributionCategories.filter(category => category.is_savings && !category.deleted_at);
  const savingsTargetPercent = savingsBuckets.length > 0
    ? savingsBuckets.reduce((sum, category) => sum + category.percentage, 0)
    : null;
  const savingsStatus: SavingsStatus = savingsRate === null || savingsTargetPercent === null
    ? 'unknown'
    : savingsRate >= savingsTargetPercent ? 'met' : 'below';

  return {
    income,
    expense,
    netBalance: income - expense,
    expensePercentOfBudget: budgetBase > 0 ? Math.round((expense * 100) / budgetBase) : null,
    spentPercentOfIncome: income > 0 ? Math.round((expense * 100) / income) : null,
    savingsRate,
    savingsTargetPercent,
    savingsStatus,
    capital,
    accountCount,
  };
}

export interface SavingsInsight {
  title: string;
  body: string;
}

/** Copy for the "Tasa de ahorro" insight card, built only from the cycle's real income and spending. */
export function describeSavingsInsight(kpis: Pick<FinancesKpis, 'savingsRate' | 'spentPercentOfIncome'>): SavingsInsight {
  if (kpis.savingsRate === null || kpis.spentPercentOfIncome === null) {
    return { title: 'Tasa de ahorro: —', body: 'Registra un ingreso este mes para calcular tu tasa de ahorro.' };
  }
  const title = `Tasa de ahorro: ${kpis.savingsRate}%`;
  if (kpis.spentPercentOfIncome > 100) {
    return { title, body: `Has gastado más de lo que ingresaste este mes (${kpis.spentPercentOfIncome}% de tus ingresos).` };
  }
  return { title, body: `Has gastado el ${kpis.spentPercentOfIncome}% de lo que ingresaste este mes.` };
}
