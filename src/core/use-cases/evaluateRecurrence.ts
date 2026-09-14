import { Movement } from '../domain/models/types';

export function evaluateRecurrence(
  lastEvalMonth: string | undefined,
  currentDate: Date,
  allMovements: Movement[]
): {
  shouldUpdate: boolean;
  newEvalMonth: string;
  clonedMovements: Omit<Movement, 'id' | 'created_at' | 'updated_at'>[];
} {
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  if (lastEvalMonth === currentMonthStr) {
    return { shouldUpdate: false, newEvalMonth: currentMonthStr, clonedMovements: [] };
  }

  // We should clone movements. We only care about active recurring movements.
  // In a robust system, we'd check if they were already cloned this month to avoid duplicates if lastEvalMonth was corrupted.
  // For MVP: Find all movements that are is_recurring = true, and create a clone for the current month.
  
  // Note: To avoid cloning a movement multiple times if lastEvalMonth is very old, we just clone the UNIQUE recurring base movements.
  // The simplest heuristic is: group by description + amount + type + category, and take one.
  // For MVP, we will just clone all is_recurring == true that happened in the lastEvalMonth. If lastEvalMonth is empty, we don't clone anything (first run).
  
  if (!lastEvalMonth) {
    return { shouldUpdate: true, newEvalMonth: currentMonthStr, clonedMovements: [] };
  }

  const [lastYearStr, lastMonthStr] = lastEvalMonth.split('-');
  const lastYear = parseInt(lastYearStr, 10);
  const lastMonth = parseInt(lastMonthStr, 10) - 1; // 0-indexed

  // Get recurring movements that were recorded in the last evaluated month
  const activeRecurring = allMovements.filter(m => {
    if (!m.is_recurring) return false;
    
    const mDate = new Date(m.date);
    return mDate.getFullYear() === lastYear && mDate.getMonth() === lastMonth;
  });

  const clonedMovements = activeRecurring.map(m => {
    return {
      user_id: m.user_id,
      type: m.type,
      amount: m.amount,
      date: currentDate, // clone to today
      description: m.description,
      distribution_category_id: m.distribution_category_id,
      expense_category_id: m.expense_category_id,
      expense_subcategory_id: m.expense_subcategory_id,
      income_source_id: m.income_source_id,
      savings_goal_id: m.savings_goal_id,
      is_recurring: true,
      deleted_at: undefined,
    };
  });

  return {
    shouldUpdate: true,
    newEvalMonth: currentMonthStr,
    clonedMovements,
  };
}
