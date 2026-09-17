export type UUID = string;

export interface BaseEntity {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Profile extends BaseEntity {
  id: UUID;
  last_recurrence_eval_month?: string; // YYYY-MM
}

export interface IncomeSource extends BaseEntity {
  id: UUID;
  user_id: UUID;
  name: string;
  amount: number; // in cents
}

export interface DistributionCategory extends BaseEntity {
  id: UUID;
  user_id: UUID;
  name: string;
  percentage: number; // 1-100
  is_default: boolean;
  is_savings: boolean; // identifies the "savings" bucket for goal assignment (RF-14), not a name match
}

export interface ExpenseCategory extends BaseEntity {
  id: UUID;
  user_id: UUID;
  distribution_category_id: UUID; // every expense category belongs to exactly one distribution bucket (RF-08)
  name: string;
}

export interface ExpenseSubcategory extends BaseEntity {
  id: UUID;
  category_id: UUID;
  name: string;
}

export interface SavingsGoal extends BaseEntity {
  id: UUID;
  user_id: UUID;
  name: string;
  target_amount: number; // in cents
  deadline?: Date;
}

export interface Movement extends BaseEntity {
  id: UUID;
  user_id: UUID;
  type: 'INCOME' | 'EXPENSE';
  amount: number; // in cents
  date: Date;
  description?: string;
  distribution_category_id?: UUID;
  expense_category_id?: UUID;
  expense_subcategory_id?: UUID;
  income_source_id?: UUID;
  savings_goal_id?: UUID;
  is_recurring: boolean;
}
