import type { DistributionCategory, ExpenseCategory, ExpenseSubcategory, Movement } from '../domain/models/types';
import { calculateBudgets } from './calculateBudgets';
import { calculateCategoryBreakdown } from './calculateCategoryBreakdown';
import { budgetStatusFor, type BudgetStatus } from './budgetStatus';

export interface RuleSubcategory { id: string; name: string; spent: number }

export interface RuleCategory {
  id: string;
  name: string;
  /** Cents spent in this category during the cycle. */
  spent: number;
  /** Whole-number percent of the bucket's spending that went to this category (0 when the bucket has none). */
  share: number;
  subcategories: RuleSubcategory[];
}

export interface RuleBucket {
  id: string;
  name: string;
  percentage: number;
  /** Cents: expected income x bucket percentage. */
  budget: number;
  spent: number;
  /** spent / budget as a percentage (may exceed 100; 0 when the budget is 0). */
  progress: number;
  usedPercent: number;
  status: BudgetStatus;
  /** budget - spent (negative when over budget). */
  remaining: number;
  categories: RuleCategory[];
  /** Spending filed in the bucket without an expense category (e.g. loan installments), never negative. */
  uncategorized: number;
}

export interface RuleView {
  /** Expected monthly income the percentages apply to. */
  base: number;
  hasBuckets: boolean;
  buckets: RuleBucket[];
  totalBudget: number;
  totalSpent: number;
  /** Whole-number percent of the budget base already spent; null when there is no base. */
  spentPercentOfBase: number | null;
  /** totalBudget - totalSpent. */
  remaining: number;
  status: BudgetStatus;
}

/**
 * Regla 50/30/20 for one cycle: budget vs spent per bucket plus the spending of each expense
 * category as a share of its bucket. Composes `calculateBudgets` / `calculateCategoryBreakdown`
 * / `budgetStatusFor`; transfers and adjustments never count (they are excluded by the breakdown).
 */
export function buildRuleView(
  movements: Movement[],
  distributionCategories: DistributionCategory[],
  expenseCategories: ExpenseCategory[],
  expenseSubcategories: ExpenseSubcategory[],
  expectedIncome: number,
): RuleView {
  const breakdown = calculateCategoryBreakdown(movements, distributionCategories, expenseCategories, expenseSubcategories);
  const budgets = calculateBudgets(expectedIncome, distributionCategories);

  const buckets: RuleBucket[] = [...budgets]
    .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name, 'es'))
    .map(budgeted => {
      const bucket = breakdown.find(b => b.id === budgeted.id);
      const spent = bucket?.spent ?? 0;
      const progress = budgeted.budget > 0 ? (spent / budgeted.budget) * 100 : 0;
      const categories: RuleCategory[] = [...(bucket?.categories ?? [])]
        .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, 'es'))
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          spent: cat.spent,
          share: spent > 0 ? Math.min(100, Math.round((cat.spent * 100) / spent)) : 0,
          subcategories: cat.subcategories.map(sub => ({ id: sub.id, name: sub.name, spent: sub.spent })),
        }));
      const categorized = categories.reduce((sum, cat) => sum + cat.spent, 0);
      return {
        id: budgeted.id,
        name: budgeted.name,
        percentage: budgeted.percentage,
        budget: budgeted.budget,
        spent,
        progress,
        usedPercent: Math.round(progress),
        status: budgetStatusFor(progress),
        remaining: budgeted.budget - spent,
        categories,
        uncategorized: Math.max(0, spent - categorized),
      };
    });

  const totalBudget = buckets.reduce((sum, b) => sum + b.budget, 0);
  const totalSpent = buckets.reduce((sum, b) => sum + b.spent, 0);
  return {
    base: expectedIncome,
    hasBuckets: distributionCategories.length > 0,
    buckets,
    totalBudget,
    totalSpent,
    spentPercentOfBase: totalBudget > 0 ? Math.round((totalSpent * 100) / totalBudget) : null,
    remaining: totalBudget - totalSpent,
    status: budgetStatusFor(totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0),
  };
}
