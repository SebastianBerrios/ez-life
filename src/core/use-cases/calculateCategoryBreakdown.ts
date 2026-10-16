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
  const totals: Record<UUID, number> = Object.fromEntries(distributionCategories.map(bucket => [bucket.id, 0]));
  for (const movement of movements) {
    if (movement.type === 'EXPENSE' && !movement.is_adjustment && !movement.deleted_at && movement.distribution_category_id && Object.hasOwn(totals, movement.distribution_category_id)) totals[movement.distribution_category_id] += movement.amount;
  }
  return totals;
}

export function calculateCategoryBreakdown(
  movements: Movement[],
  distributionCategories: DistributionCategory[],
  expenseCategories: ExpenseCategory[],
  expenseSubcategories: ExpenseSubcategory[]
): DistributionBreakdown[] {
  const buckets = new Map<UUID, number>();
  const categoriesSpent = new Map<UUID, number>();
  const subcategoriesSpent = new Map<UUID, number>();
  for (const movement of movements) {
    if (movement.type !== 'EXPENSE' || movement.is_adjustment || movement.deleted_at) continue;
    for (const [id, totals] of [[movement.distribution_category_id, buckets], [movement.expense_category_id, categoriesSpent], [movement.expense_subcategory_id, subcategoriesSpent]] as const) {
      if (id) totals.set(id, (totals.get(id) ?? 0) + movement.amount);
    }
  }
  const categoriesByBucket = new Map<UUID, CategoryBreakdown[]>();
  const subcategoriesByCategory = new Map<UUID, SubcategoryBreakdown[]>();
  for (const sub of expenseSubcategories) {
    const list = subcategoriesByCategory.get(sub.category_id) ?? [];
    list.push({ id: sub.id, name: sub.name, spent: subcategoriesSpent.get(sub.id) ?? 0 });
    subcategoriesByCategory.set(sub.category_id, list);
  }
  for (const cat of expenseCategories) {
    const list = categoriesByBucket.get(cat.distribution_category_id) ?? [];
    list.push({
        id: cat.id,
        name: cat.name,
        spent: categoriesSpent.get(cat.id) ?? 0,
        subcategories: subcategoriesByCategory.get(cat.id) ?? [],
    });
    categoriesByBucket.set(cat.distribution_category_id, list);
  }
  return distributionCategories.map(bucket => ({
      id: bucket.id,
      name: bucket.name,
      percentage: bucket.percentage,
      spent: buckets.get(bucket.id) ?? 0,
      categories: categoriesByBucket.get(bucket.id) ?? [],
  }));
}
