import { db } from '../../db/db';
import { IMovementRepository } from '../../../core/domain/repositories/IRepositories';
import { Movement, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalMovementRepository implements IMovementRepository {
  async getAllByCycle(userId: UUID, startDate: Date, endDate: Date): Promise<Movement[]> {
    const records = await db.movements
      .where('user_id')
      .equals(userId)
      .and(m => !m.deleted_at && m.date >= startDate && m.date <= endDate)
      .toArray();
      
    return records as Movement[];
  }

  async getAll(userId: UUID): Promise<Movement[]> {
    const records = await db.movements
      .where('user_id')
      .equals(userId)
      .filter(m => !m.deleted_at)
      .toArray();
      
    return records as Movement[];
  }

  async save(data: Omit<Movement, 'created_at' | 'updated_at'>): Promise<Movement> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.movements.get(id);
    
    const movement: Movement = existing 
      ? { ...existing, ...data, id, updated_at: now }
      : { ...data, id, created_at: now, updated_at: now };
      
    await db.movements.put(movement);
    return movement;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.movements.get(id);
    if (existing) {
      await db.movements.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }

  async countByDistributionCategory(categoryId: UUID): Promise<number> {
    return await db.movements.filter(m => m.distribution_category_id === categoryId && !m.deleted_at).count();
  }

  async countByExpenseCategory(categoryId: UUID): Promise<number> {
    return await db.movements.filter(m => m.expense_category_id === categoryId && !m.deleted_at).count();
  }

  async countByExpenseSubcategory(subcategoryId: UUID): Promise<number> {
    return await db.movements.filter(m => m.expense_subcategory_id === subcategoryId && !m.deleted_at).count();
  }

  async countBySavingsGoal(goalId: UUID): Promise<number> {
    return await db.movements.filter(m => m.savings_goal_id === goalId && !m.deleted_at).count();
  }
}
