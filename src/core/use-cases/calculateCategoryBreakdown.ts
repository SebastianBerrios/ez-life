import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, Movement, UUID } from '../domain/models/types';

export interface SubcategoryBreakdown {
  id: UUID;
  name: string;
  spent: number;
}

export interface CategoryBreakdown {
  id: UUID;
  name: string;
  spent: number;
  subcategories: SubcategoryBreakdown[];
}

export interface DistributionBreakdown {
  id: UUID;
  name: string;
  percentage: number;
  spent: number;
  categories: CategoryBreakdown[];
}

/**
 * Total spent (EXPENSE movements only) per distribution bucket, keyed by
 * bucket id. Shared by `Dashboard.tsx` (budget-vs-spent display) and
 * `evaluateNotifications` (80%-of-budget alerts) so the "spent per bucket"
 * formula lives in exactly one place.
 */
export function calculateSpentByBucket(
  movements: Movement[],
  distributionCategories: DistributionCategory[]
): Record<UUID, number> {
  const expenses = movements.filter(m => m.type === 'EXPENSE');

  return distributionCategories.reduce<Record<UUID, number>>((acc, bucket) => {
    acc[bucket.id] = expenses
      .filter(m => m.distribution_category_id === bucket.id)
      .reduce((sum, m) => sum + m.amount, 0);
    return acc;
  }, {});
}

export function calculateCategoryBreakdown(
  movements: Movement[],
  distributionCategories: DistributionCategory[],
  expenseCategories: ExpenseCategory[],
  expenseSubcategories: ExpenseSubcategory[]
): DistributionBreakdown[] {
  const expenses = movements.filter(m => m.type === 'EXPENSE');
  const sumFor = (predicate: (m: Movement) => boolean) =>
    expenses.filter(predicate).reduce((acc, m) => acc + m.amount, 0);

  return distributionCategories.map(bucket => {
    const categories: CategoryBreakdown[] = expenseCategories
      .filter(cat => cat.distribution_category_id === bucket.id)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        spent: sumFor(m => m.expense_category_id === cat.id),
        subcategories: expenseSubcategories
          .filter(sub => sub.category_id === cat.id)
          .map(sub => ({
            id: sub.id,
            name: sub.name,
            spent: sumFor(m => m.expense_subcategory_id === sub.id),
          })),
      }));

    return {
      id: bucket.id,
      name: bucket.name,
      percentage: bucket.percentage,
      spent: sumFor(m => m.distribution_category_id === bucket.id),
      categories,
    };
  });
}
