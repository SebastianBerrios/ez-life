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
    const highestCat = budgets.reduce((prev, curr) => 
      (prev.percentage > curr.percentage) ? prev : curr
    );
    highestCat.budget += Math.round(remainingCents);
  }
  
  return budgets;
}
