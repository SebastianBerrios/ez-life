import { db } from '../../db/db';
import { IIncomeSourceRepository } from '../../../core/domain/repositories/IRepositories';
import { IncomeSource, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

export class LocalIncomeSourceRepository implements IIncomeSourceRepository {
  async getAll(userId: UUID): Promise<IncomeSource[]> {
    return await db.income_sources.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async save(sourceData: Omit<IncomeSource, 'created_at' | 'updated_at'>): Promise<IncomeSource> {
    const now = new Date();
    const id = sourceData.id || uuidv7();
    const existing = await db.income_sources.get(id);
    
    let source: IncomeSource;
    if (existing) {
      source = { ...existing, ...sourceData, id, updated_at: now };
    } else {
      source = { ...sourceData, id, created_at: now, updated_at: now };
    }
    
    await db.income_sources.put(source);
    return source;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.income_sources.get(id);
    if (existing) {
      await db.income_sources.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
