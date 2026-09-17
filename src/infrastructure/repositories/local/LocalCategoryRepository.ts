import { db } from '../../db/db';
import { ICategoryRepository } from '../../../core/domain/repositories/IRepositories';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalCategoryRepository implements ICategoryRepository {
  async getDistributionCategories(userId: UUID): Promise<DistributionCategory[]> {
    return await db.distribution_categories.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async saveDistributionCategory(data: Omit<DistributionCategory, 'created_at' | 'updated_at'>): Promise<DistributionCategory> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.distribution_categories.get(id);
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: now, updated_at: now };
    await db.distribution_categories.put(cat);
    return cat;
  }

  async deleteDistributionCategory(id: UUID): Promise<void> {
    const existing = await db.distribution_categories.get(id);
    if (existing) await db.distribution_categories.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
  }

  async getExpenseCategories(userId: UUID): Promise<ExpenseCategory[]> {
    return await db.expense_categories.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async saveExpenseCategory(data: Omit<ExpenseCategory, 'created_at' | 'updated_at'>): Promise<ExpenseCategory> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.expense_categories.get(id);
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: now, updated_at: now };
    await db.expense_categories.put(cat);
    return cat;
  }

  async deleteExpenseCategory(id: UUID): Promise<void> {
    const existing = await db.expense_categories.get(id);
    if (existing) await db.expense_categories.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
  }

  async countExpenseCategoriesByDistribution(distributionCategoryId: UUID): Promise<number> {
    return await db.expense_categories
      .filter(c => c.distribution_category_id === distributionCategoryId && !c.deleted_at)
      .count();
  }

  async getSubcategories(categoryId: UUID): Promise<ExpenseSubcategory[]> {
    return await db.expense_subcategories.where('category_id').equals(categoryId).filter(x => !x.deleted_at).toArray();
  }

  async saveSubcategory(data: Omit<ExpenseSubcategory, 'created_at' | 'updated_at'>): Promise<ExpenseSubcategory> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.expense_subcategories.get(id);
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: now, updated_at: now };
    await db.expense_subcategories.put(cat);
    return cat;
  }

  async deleteSubcategory(id: UUID): Promise<void> {
    const existing = await db.expense_subcategories.get(id);
    if (existing) await db.expense_subcategories.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
  }
}
