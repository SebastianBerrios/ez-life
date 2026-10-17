import { Movement, MovementRecurrence } from '../domain/models/types';
export function evaluateMonthlyRecurrences(rules: MovementRecurrence[], occurrences: Movement[], now: Date): Omit<Movement, 'id' | 'created_at' | 'updated_at'>[] {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const existing = new Set(occurrences.map(row => `${row.recurrence_rule_id}:${row.recurrence_month}`));
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return rules.filter(rule => rule.active && !rule.deleted_at && rule.activated_month <= month && !existing.has(`${rule.id}:${month}`))
    .map(rule => ({
      user_id: rule.user_id, type: rule.type, amount: rule.amount,
      date: new Date(now.getFullYear(), now.getMonth(), Math.min(rule.day_of_month, lastDay), 12),
      description: rule.description, distribution_category_id: rule.distribution_category_id,
      expense_category_id: rule.expense_category_id, expense_subcategory_id: rule.expense_subcategory_id,
      income_source_id: rule.income_source_id, savings_goal_id: rule.savings_goal_id,
      account_id: rule.account_id, to_account_id: rule.to_account_id,
      is_recurring: false, is_adjustment: rule.is_adjustment,
      recurrence_rule_id: rule.id, recurrence_month: month,
    })).filter(row => row.date.getDate() <= now.getDate());
}
