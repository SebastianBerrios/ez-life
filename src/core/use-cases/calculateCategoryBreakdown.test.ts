import { describe, it, expect } from 'vitest';
import { calculateCategoryBreakdown, calculateSpentByBucket } from './calculateCategoryBreakdown';
import type { DistributionCategory, ExpenseCategory, ExpenseSubcategory, Movement } from '../domain/models/types';

describe('calculateCategoryBreakdown', () => {
  it('builds a bucket -> category -> subcategory tree with real spend totals', () => {
    const buckets = [
      { id: 'b1', name: 'Necesidades', percentage: 50 },
      { id: 'b2', name: 'Gustos', percentage: 30 },
    ] as Pick<DistributionCategory, 'id' | 'name' | 'percentage'>[] as DistributionCategory[];

    const categories = [
      { id: 'c1', distribution_category_id: 'b1', name: 'Alimentación' },
      { id: 'c2', distribution_category_id: 'b2', name: 'Ocio' },
    ] as Pick<ExpenseCategory, 'id' | 'distribution_category_id' | 'name'>[] as ExpenseCategory[];

    const subcategories = [
      { id: 's1', category_id: 'c1', name: 'Almuerzo' },
      { id: 's2', category_id: 'c1', name: 'Cena' },
    ] as Pick<ExpenseSubcategory, 'id' | 'category_id' | 'name'>[] as ExpenseSubcategory[];

    const movements = [
      { type: 'EXPENSE', amount: 1000, distribution_category_id: 'b1', expense_category_id: 'c1', expense_subcategory_id: 's1' },
      { type: 'EXPENSE', amount: 500, distribution_category_id: 'b1', expense_category_id: 'c1', expense_subcategory_id: 's2' },
      { type: 'EXPENSE', amount: 300, distribution_category_id: 'b2', expense_category_id: 'c2', expense_subcategory_id: undefined },
      { type: 'INCOME', amount: 99999, distribution_category_id: undefined, expense_category_id: undefined, expense_subcategory_id: undefined },
    ] as Partial<Movement>[] as Movement[];

    const result = calculateCategoryBreakdown(movements, buckets, categories, subcategories);

    expect(result).toHaveLength(2);

    const necesidades = result.find(b => b.id === 'b1')!;
    expect(necesidades.spent).toBe(1500);
    expect(necesidades.categories).toHaveLength(1);
    expect(necesidades.categories[0].spent).toBe(1500);
    expect(necesidades.categories[0].subcategories.find(s => s.id === 's1')?.spent).toBe(1000);
    expect(necesidades.categories[0].subcategories.find(s => s.id === 's2')?.spent).toBe(500);

    const gustos = result.find(b => b.id === 'b2')!;
    expect(gustos.spent).toBe(300);
    expect(gustos.categories[0].spent).toBe(300);
    expect(gustos.categories[0].subcategories).toHaveLength(0);
  });

  it('returns zeroed buckets when there are no expenses yet', () => {
    const buckets = [
      { id: 'b1', name: 'Necesidades', percentage: 100 },
    ] as Pick<DistributionCategory, 'id' | 'name' | 'percentage'>[] as DistributionCategory[];

    const result = calculateCategoryBreakdown([], buckets, [], []);

    expect(result).toEqual([{ id: 'b1', name: 'Necesidades', percentage: 100, spent: 0, categories: [] }]);
  });
});

describe('calculateSpentByBucket', () => {
  it('sums EXPENSE movements per bucket, ignoring INCOME', () => {
    const buckets = [
      { id: 'b1', name: 'Necesidades', percentage: 50 },
      { id: 'b2', name: 'Gustos', percentage: 30 },
    ] as Pick<DistributionCategory, 'id' | 'name' | 'percentage'>[] as DistributionCategory[];

    const movements = [
      { type: 'EXPENSE', amount: 1000, distribution_category_id: 'b1' },
      { type: 'EXPENSE', amount: 500, distribution_category_id: 'b1' },
      { type: 'EXPENSE', amount: 300, distribution_category_id: 'b2' },
      { type: 'INCOME', amount: 99999, distribution_category_id: 'b1' },
    ] as Partial<Movement>[] as Movement[];

    const result = calculateSpentByBucket(movements, buckets);

    expect(result).toEqual({ b1: 1500, b2: 300 });
  });

  it('returns a zeroed entry for buckets with no expenses', () => {
    const buckets = [
      { id: 'b1', name: 'Necesidades', percentage: 100 },
    ] as Pick<DistributionCategory, 'id' | 'name' | 'percentage'>[] as DistributionCategory[];

    const result = calculateSpentByBucket([], buckets);

    expect(result).toEqual({ b1: 0 });
  });
});
