import { describe, expect, it } from 'vitest';
import type { DistributionCategory, ExpenseCategory, ExpenseSubcategory, Movement } from '../domain/models/types';
import { buildRuleView } from './buildRuleView';

const now = new Date();
const bucket = (id: string, name: string, percentage: number, is_savings = false): DistributionCategory =>
  ({ id, user_id: 'u', name, percentage, is_default: true, is_savings, created_at: now, updated_at: now });
const category = (id: string, name: string, distribution_category_id: string): ExpenseCategory =>
  ({ id, user_id: 'u', name, distribution_category_id, created_at: now, updated_at: now });
const sub = (id: string, name: string, category_id: string): ExpenseSubcategory =>
  ({ id, name, category_id, created_at: now, updated_at: now });
const expense = (id: string, amount: number, patch: Partial<Movement> = {}): Movement => ({
  id, user_id: 'u', type: 'EXPENSE', amount, date: now, is_recurring: false, created_at: now, updated_at: now, ...patch,
});

const buckets = [bucket('wants', 'Deseos', 30), bucket('needs', 'Necesidades', 50), bucket('save', 'Ahorro', 20, true)];
const categories = [category('food', 'Alimentación', 'needs'), category('rent', 'Vivienda', 'needs'), category('fun', 'Ocio', 'wants')];
const subs = [sub('rest', 'Restaurantes', 'food')];

describe('buildRuleView', () => {
  it('orders buckets by percentage and computes budget, spent, usage and status', () => {
    const view = buildRuleView([
      expense('1', 60000, { distribution_category_id: 'needs', expense_category_id: 'food' }),
      expense('2', 100000, { distribution_category_id: 'needs', expense_category_id: 'rent' }),
      expense('3', 7000, { distribution_category_id: 'wants', expense_category_id: 'fun' }),
    ], buckets, categories, subs, 300000);

    expect(view.buckets.map(b => b.id)).toEqual(['needs', 'wants', 'save']);
    const needs = view.buckets[0];
    expect(needs).toMatchObject({ budget: 150000, spent: 160000, usedPercent: 107, status: 'over', remaining: -10000 });
    expect(view.buckets[1]).toMatchObject({ budget: 90000, spent: 7000, usedPercent: 8, status: 'ok' });
    expect(view.buckets[2]).toMatchObject({ budget: 60000, spent: 0, usedPercent: 0, status: 'ok' });
    expect(view).toMatchObject({ base: 300000, totalBudget: 300000, totalSpent: 167000, spentPercentOfBase: 56, remaining: 133000, status: 'ok', hasBuckets: true });
  });

  it('lists categories by spend with their share of the bucket and subcategories', () => {
    const view = buildRuleView([
      expense('1', 60000, { distribution_category_id: 'needs', expense_category_id: 'food', expense_subcategory_id: 'rest' }),
      expense('2', 20000, { distribution_category_id: 'needs', expense_category_id: 'rent' }),
    ], buckets, categories, subs, 300000);
    const [first, second] = view.buckets[0].categories;
    expect(first).toMatchObject({ id: 'food', spent: 60000, share: 75 });
    expect(first.subcategories).toEqual([{ id: 'rest', name: 'Restaurantes', spent: 60000 }]);
    expect(second).toMatchObject({ id: 'rent', spent: 20000, share: 25 });
  });

  it('reports spending filed in a bucket without a category as uncategorized', () => {
    const view = buildRuleView([
      expense('1', 10000, { distribution_category_id: 'needs', expense_category_id: 'food' }),
      expense('2', 5000, { distribution_category_id: 'needs' }),
    ], buckets, categories, subs, 300000);
    expect(view.buckets[0]).toMatchObject({ spent: 15000, uncategorized: 5000 });
    expect(view.buckets[1].uncategorized).toBe(0);
  });

  it('never counts transfers, incomes, adjustments or deleted rows', () => {
    const view = buildRuleView([
      expense('t', 9999, { type: 'TRANSFER' }),
      expense('i', 9999, { type: 'INCOME', distribution_category_id: 'needs' }),
      expense('a', 9999, { is_adjustment: true, distribution_category_id: 'needs' }),
      expense('d', 9999, { distribution_category_id: 'needs', expense_category_id: 'food', deleted_at: now }),
    ], buckets, categories, subs, 300000);
    expect(view.totalSpent).toBe(0);
  });

  it('flags the warning band and keeps shares at 0 when nothing was spent', () => {
    const view = buildRuleView([expense('1', 120000, { distribution_category_id: 'needs', expense_category_id: 'food' })], buckets, categories, subs, 300000);
    expect(view.buckets[0]).toMatchObject({ usedPercent: 80, status: 'warning' });
    expect(view.buckets[1].categories[0].share).toBe(0);
  });

  it('handles a missing budget base without dividing by zero', () => {
    const view = buildRuleView([expense('1', 500, { distribution_category_id: 'needs', expense_category_id: 'food' })], buckets, categories, subs, 0);
    expect(view.spentPercentOfBase).toBeNull();
    expect(view.buckets[0]).toMatchObject({ budget: 0, progress: 0, usedPercent: 0, status: 'ok' });
    expect(view.totalSpent).toBe(500);
  });

  it('reports no buckets for a user without a distribution', () => {
    const view = buildRuleView([], [], [], [], 100000);
    expect(view).toMatchObject({ hasBuckets: false, buckets: [], totalBudget: 0, totalSpent: 0, spentPercentOfBase: null });
  });
});
