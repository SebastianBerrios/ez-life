import { UUID, Profile, IncomeSource, DistributionCategory, ExpenseCategory, ExpenseSubcategory, SavingsGoal, Movement } from '../models/types';

export interface IProfileRepository {
  get(id: UUID): Promise<Profile | undefined>;
  save(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile>;
}

export interface IIncomeSourceRepository {
  getAll(userId: UUID): Promise<IncomeSource[]>;
  save(incomeSource: Omit<IncomeSource, 'created_at' | 'updated_at'>): Promise<IncomeSource>;
  delete(id: UUID): Promise<void>;
}

export interface ICategoryRepository {
  getDistributionCategories(userId: UUID): Promise<DistributionCategory[]>;
  saveDistributionCategory(category: Omit<DistributionCategory, 'created_at' | 'updated_at'>): Promise<DistributionCategory>;
  deleteDistributionCategory(id: UUID): Promise<void>;

  getExpenseCategories(userId: UUID): Promise<ExpenseCategory[]>;
  saveExpenseCategory(category: Omit<ExpenseCategory, 'created_at' | 'updated_at'>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: UUID): Promise<void>;

  getSubcategories(categoryId: UUID): Promise<ExpenseSubcategory[]>;
  saveSubcategory(subcategory: Omit<ExpenseSubcategory, 'created_at' | 'updated_at'>): Promise<ExpenseSubcategory>;
  deleteSubcategory(id: UUID): Promise<void>;
}

export interface ISavingsGoalRepository {
  getAll(userId: UUID): Promise<SavingsGoal[]>;
  save(goal: Omit<SavingsGoal, 'created_at' | 'updated_at'>): Promise<SavingsGoal>;
  delete(id: UUID): Promise<void>;
}

export interface IMovementRepository {
  getAllByCycle(userId: UUID, startDate: Date, endDate: Date): Promise<Movement[]>;
  getAll(userId: UUID): Promise<Movement[]>;
  save(data: Omit<Movement, 'created_at' | 'updated_at'>): Promise<Movement>;
  delete(id: UUID): Promise<void>;
  countByDistributionCategory(categoryId: UUID): Promise<number>;
  countByExpenseCategory(categoryId: UUID): Promise<number>;
  countByExpenseSubcategory(subcategoryId: UUID): Promise<number>;
  countBySavingsGoal(goalId: UUID): Promise<number>;
}
