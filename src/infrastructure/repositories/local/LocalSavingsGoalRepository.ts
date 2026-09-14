import { db } from '../../db/db';
import { ISavingsGoalRepository } from '../../../core/domain/repositories/IRepositories';
import { SavingsGoal, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalSavingsGoalRepository implements ISavingsGoalRepository {
  async getAll(userId: UUID): Promise<SavingsGoal[]> {
    return await db.savings_goals.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async save(data: Omit<SavingsGoal, 'created_at' | 'updated_at'>): Promise<SavingsGoal> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.savings_goals.get(id);
    
    let goal: SavingsGoal;
    if (existing) {
      goal = { ...existing, ...data, id, updated_at: now };
    } else {
      goal = { ...data, id, created_at: now, updated_at: now };
    }
    
    await db.savings_goals.put(goal);
    return goal;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.savings_goals.get(id);
    if (existing) {
      await db.savings_goals.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
