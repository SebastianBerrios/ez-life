import { DistributionCategory } from '../domain/models/types';

export type BudgetedCategory = DistributionCategory & { budget: number };

export function calculateBudgets(totalIncomeCents: number, categories: DistributionCategory[]): BudgetedCategory[] {
  let remainingCents = totalIncomeCents;
  
  const budgets = categories.map(cat => {
    const exactAmount = (totalIncomeCents * cat.percentage) / 100;
    const intAmount = Math.floor(exactAmount);
    remainingCents -= intAmount;
    return { ...cat, budget: intAmount };
  });

  if (remainingCents > 0 && budgets.length > 0) {
    // Tie-break deterministically: highest percentage wins; on a tie, the
    // lexicographically smallest id wins, regardless of array/DB order.
    const highestCat = budgets.reduce((prev, curr) => {
      if (curr.percentage > prev.percentage) return curr;
      if (curr.percentage === prev.percentage && curr.id.localeCompare(prev.id) < 0) return curr;
      return prev;
    });
    highestCat.budget += Math.round(remainingCents);
  }
  
  return budgets;
}
