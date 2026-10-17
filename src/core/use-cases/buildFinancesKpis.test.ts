import { describe, expect, it } from 'vitest';
import type { DistributionCategory } from '../domain/models/types';
import { buildFinancesKpis, describeSavingsInsight } from './buildFinancesKpis';

const now = new Date();
const bucket = (id: string, percentage: number, is_savings = false, deleted_at?: Date): DistributionCategory =>
  ({ id, user_id: 'u', name: id, percentage, is_default: true, is_savings, created_at: now, updated_at: now, deleted_at });

const base = { budgetBase: 300000, capital: 150000, accountCount: 2 };

describe('buildFinancesKpis', () => {
  it('derives net balance, percentages and the savings status against the savings bucket', () => {
    const kpis = buildFinancesKpis({ ...base, income: 300000, expense: 120000, distributionCategories: [bucket('needs', 80), bucket('save', 20, true)] });
    expect(kpis).toMatchObject({
      income: 300000, expense: 120000, netBalance: 180000, expensePercentOfBudget: 40, spentPercentOfIncome: 40,
      savingsRate: 60, savingsTargetPercent: 20, savingsStatus: 'met', capital: 150000, accountCount: 2,
    });
  });

  it('marks the savings rate below target', () => {
    const kpis = buildFinancesKpis({ ...base, income: 300000, expense: 270000, distributionCategories: [bucket('save', 20, true)] });
    expect(kpis).toMatchObject({ savingsRate: 10, savingsTargetPercent: 20, savingsStatus: 'below' });
  });

  it('shows no target without a savings bucket and ignores deleted ones', () => {
    const none = buildFinancesKpis({ ...base, income: 100000, expense: 10000, distributionCategories: [bucket('needs', 100)] });
    expect(none).toMatchObject({ savingsTargetPercent: null, savingsStatus: 'unknown', savingsRate: 90 });
    const deleted = buildFinancesKpis({ ...base, income: 100000, expense: 10000, distributionCategories: [bucket('save', 20, true, now)] });
    expect(deleted.savingsTargetPercent).toBeNull();
  });

  it('leaves the rate and income-based percentages undefined without income', () => {
    const kpis = buildFinancesKpis({ ...base, income: 0, expense: 5000, distributionCategories: [] });
    expect(kpis).toMatchObject({ savingsRate: null, spentPercentOfIncome: null, savingsStatus: 'unknown', netBalance: -5000 });
  });

  it('leaves the budget percentage undefined without a budget base and does not clamp overspending', () => {
    expect(buildFinancesKpis({ ...base, budgetBase: 0, income: 0, expense: 5000, distributionCategories: [] }).expensePercentOfBudget).toBeNull();
    expect(buildFinancesKpis({ ...base, income: 300000, expense: 450000, distributionCategories: [] }).expensePercentOfBudget).toBe(150);
  });
});

describe('describeSavingsInsight', () => {
  it('explains the spending against the income', () => {
    expect(describeSavingsInsight({ savingsRate: 60, spentPercentOfIncome: 40 })).toEqual({
      title: 'Tasa de ahorro: 60%', body: 'Has gastado el 40% de lo que ingresaste este mes.',
    });
  });
  it('flags overspending', () => {
    expect(describeSavingsInsight({ savingsRate: -50, spentPercentOfIncome: 150 })).toEqual({
      title: 'Tasa de ahorro: -50%', body: 'Has gastado más de lo que ingresaste este mes (150% de tus ingresos).',
    });
  });
  it('asks for an income when there is none', () => {
    expect(describeSavingsInsight({ savingsRate: null, spentPercentOfIncome: null }).title).toBe('Tasa de ahorro: —');
  });
});
