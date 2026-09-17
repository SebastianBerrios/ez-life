export type UUID = string;

export interface BaseEntity {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Profile extends BaseEntity {
  id: UUID;
  last_recurrence_eval_month?: string; // YYYY-MM
  notification_hour?: number; // 0-23, local hour for the daily reminder (RF-16)
  push_enabled?: boolean; // browser Notification API opt-in
  inapp_enabled?: boolean; // in-app notification history opt-in
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

export type NotificationType = 'budget_over_80' | 'goal_completed' | 'daily_reminder';

export interface Notification extends BaseEntity {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  read_at?: Date;
  related_id?: string; // bucket id (budget_over_80) or goal id (goal_completed)
  cycle_key?: string; // 'YYYY-MM' for budget_over_80, 'YYYY-MM-DD' for daily_reminder, undefined for goal_completed
}
