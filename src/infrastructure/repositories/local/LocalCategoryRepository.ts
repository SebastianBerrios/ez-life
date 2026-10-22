import { db } from '../../db/db';
import { ICategoryRepository } from '../../../core/domain/repositories/IRepositories';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { defaultCategorySeeds } from '../../../core/use-cases/defaultCategorySeeds';
import { isValidDistributionPercentage, validateDistribution } from '../../../core/use-cases/validateDistribution';
import { DomainError } from '../../../core/domain/errors/DomainError';
import { stableId } from '../../../core/use-cases/stableId';
import { sortByCreation } from '../../../core/use-cases/sortByCreation';
import { nextCreatedAt } from './creationClock';

export class LocalCategoryRepository implements ICategoryRepository {
  async seedDefaults(userId: UUID): Promise<void> {
    await db.transaction('rw', [db.distribution_categories, db.expense_categories, db.expense_subcategories, db.movements, db.sync_queue], async () => {
      if (await db.expense_categories.where('user_id').equals(userId).filter(row => !row.deleted_at).count()) return;
      const buckets = await this.getDistributionCategories(userId);
      for (const seed of defaultCategorySeeds(userId, buckets)) {
        await this.saveExpenseCategory(seed.category, seed.subcategories.map(subcategory => subcategory.name));
      }
    });
  }
  async getDistributionCategories(userId: UUID): Promise<DistributionCategory[]> {
    return await db.distribution_categories.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async saveDistributionCategory(data: Omit<DistributionCategory, 'created_at' | 'updated_at'>): Promise<DistributionCategory> {
    if (!data.name.trim() || !isValidDistributionPercentage(data)) throw new DomainError('El nombre y porcentaje no son válidos.');
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.distribution_categories.get(id);
    if (existing && existing.user_id !== data.user_id) throw new DomainError('La distribución pertenece a otra cuenta.');
    if (existing?.is_savings && !data.is_savings && (await this.getDistributionCategories(data.user_id)).filter(row => row.is_savings && row.id !== id).length === 0) throw new DomainError('No se puede desmarcar la única categoría de ahorro.');
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: now, updated_at: now };
    await db.distribution_categories.put(cat);
    return cat;
  }

  async deleteDistributionCategory(id: UUID): Promise<void> {
    return db.transaction('rw', [db.distribution_categories, db.expense_categories, db.movements, db.sync_queue], async () => {
    const existing = await db.distribution_categories.get(id);
    if (!existing || existing.deleted_at) return;
    if (existing.is_savings || (await this.getDistributionCategories(existing.user_id)).length <= 1) throw new DomainError('No se puede eliminar la categoría de ahorro ni la única categoría de distribución.');
    if (await this.countExpenseCategoriesByDistribution(id) || await db.movements.filter(row => row.distribution_category_id === id && !row.deleted_at).count()) throw new DomainError('La distribución tiene categorías o movimientos asociados.');
    await db.distribution_categories.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    });
  }

  async saveDistributionSet(userId: UUID, rows: Omit<DistributionCategory, 'created_at' | 'updated_at'>[]): Promise<DistributionCategory[]> {
    validateDistribution(rows);
    return db.transaction('rw', [db.distribution_categories, db.expense_categories, db.movements, db.sync_queue], async () => {
      const existing = await this.getDistributionCategories(userId);
      for (const row of rows) {
        const previous = await db.distribution_categories.get(row.id);
        if (row.user_id !== userId || previous && previous.user_id !== userId) throw new DomainError('La distribución pertenece a otra cuenta.');
      }
      const now = new Date();
      for (const removed of existing.filter(row => !rows.some(next => next.id === row.id))) {
        if (await this.countExpenseCategoriesByDistribution(removed.id) || await db.movements.filter(row => row.distribution_category_id === removed.id && !row.deleted_at).count()) throw new DomainError('La distribución tiene categorías o movimientos asociados.');
        await db.distribution_categories.put({ ...removed, deleted_at: now, updated_at: now });
      }
      const result: DistributionCategory[] = [];
      for (const row of rows) {
        const previous = await db.distribution_categories.get(row.id);
        const updated = { ...row, created_at: previous?.created_at ?? now, updated_at: now };
        await db.distribution_categories.put(updated); result.push(updated);
      }
      return result;
    });
  }

  async getExpenseCategories(userId: UUID): Promise<ExpenseCategory[]> {
    return sortByCreation(await db.expense_categories.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray());
  }

  async saveExpenseCategory(data: Omit<ExpenseCategory, 'created_at' | 'updated_at'>, initialSubcategories?: string[]): Promise<ExpenseCategory> {
    return db.transaction('rw', [db.distribution_categories, db.expense_categories, db.expense_subcategories, db.movements, db.sync_queue], async () => {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.expense_categories.get(id);
    const bucket = await db.distribution_categories.get(data.distribution_category_id);
    if (!data.name.trim() || !bucket || bucket.deleted_at || bucket.user_id !== data.user_id) throw new DomainError('La categoría requiere nombre y una categoría de distribución propia.');
    if (existing && existing.user_id !== data.user_id) throw new DomainError('La categoría pertenece a otra cuenta.');
    if (initialSubcategories?.some(name => !name.trim())) throw new DomainError('Las subcategorías requieren un nombre.');
    if (existing && existing.distribution_category_id !== data.distribution_category_id && await db.movements.filter(row => row.expense_category_id === id && !row.deleted_at).count()) throw new DomainError('No se puede cambiar la categoría de distribución de una categoría con movimientos.');
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: nextCreatedAt(), updated_at: now };
    await db.expense_categories.put(cat);
    if (!existing) for (const name of initialSubcategories ?? []) await this.saveSubcategory({ id: stableId(`initial-subcategory:${id}:${name.trim()}`), category_id: id, name: name.trim() });
    return cat;
    });
  }

  async deleteExpenseCategory(id: UUID): Promise<void> {
    return db.transaction('rw', [db.expense_categories, db.expense_subcategories, db.movements, db.sync_queue], async () => {
    const existing = await db.expense_categories.get(id);
    if (!existing || existing.deleted_at) return;
    if (await db.movements.filter(row => row.expense_category_id === id && !row.deleted_at).count()) throw new DomainError('La categoría tiene movimientos asociados.');
    const now = new Date();
    for (const sub of await this.getSubcategories(id)) await db.expense_subcategories.put({ ...sub, deleted_at: now, updated_at: now });
    await db.expense_categories.put({ ...existing, deleted_at: now, updated_at: now });
    });
  }

  async countExpenseCategoriesByDistribution(distributionCategoryId: UUID): Promise<number> {
    return await db.expense_categories
      .filter(c => c.distribution_category_id === distributionCategoryId && !c.deleted_at)
      .count();
  }

  async getSubcategories(categoryId: UUID): Promise<ExpenseSubcategory[]> {
    return sortByCreation(await db.expense_subcategories.where('category_id').equals(categoryId).filter(x => !x.deleted_at).toArray());
  }

  async saveSubcategory(data: Omit<ExpenseSubcategory, 'created_at' | 'updated_at'>): Promise<ExpenseSubcategory> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.expense_subcategories.get(id);
    const category = await db.expense_categories.get(data.category_id);
    if (!data.name.trim() || !category || category.deleted_at) throw new DomainError('La subcategoría requiere una categoría activa y un nombre.');
    if (existing && existing.category_id !== data.category_id) throw new DomainError('No se puede reasignar una subcategoría.');
    const cat = existing ? { ...existing, ...data, id, updated_at: now } : { ...data, id, created_at: nextCreatedAt(), updated_at: now };
    await db.expense_subcategories.put(cat);
    return cat;
  }

  async deleteSubcategory(id: UUID): Promise<void> {
    return db.transaction('rw', [db.expense_subcategories, db.movements, db.sync_queue], async () => {
    const existing = await db.expense_subcategories.get(id);
    if (!existing || existing.deleted_at) return;
    if ((await this.getSubcategories(existing.category_id)).length <= 1) throw new DomainError('La categoría necesita al menos una subcategoría.');
    if (await db.movements.filter(row => row.expense_subcategory_id === id && !row.deleted_at).count()) throw new DomainError('La subcategoría tiene movimientos asociados.');
    await db.expense_subcategories.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    });
  }
}
