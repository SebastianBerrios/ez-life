import { db } from '../../db/db';
import { IDebtRepository } from '../../../core/domain/repositories/IRepositories';
import { Debt, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { applyDebtSettlement } from '../../../core/use-cases/applyDebtSettlement';

export class LocalDebtRepository implements IDebtRepository {
  async getAll(userId: UUID): Promise<Debt[]> {
    return await db.debts.where('user_id').equals(userId).filter(x => !x.deleted_at).toArray();
  }

  async getById(id: UUID): Promise<Debt | undefined> {
    const debt = await db.debts.get(id);
    return debt && !debt.deleted_at ? debt : undefined;
  }

  async save(data: Omit<Debt, 'created_at' | 'updated_at'>): Promise<Debt> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.debts.get(id);

    let debt: Debt;
    if (existing) {
      debt = { ...existing, ...data, id, updated_at: now };
    } else {
      debt = { ...data, id, created_at: now, updated_at: now };
    }

    await db.debts.put(debt);
    return debt;
  }

  async recordSettlement(id: UUID, paymentAmount: number): Promise<Debt> {
    const existing = await db.debts.get(id);
    if (!existing) {
      throw new Error(`Debt ${id} not found`);
    }

    const { settled_amount } = applyDebtSettlement(existing, paymentAmount);
    const updated: Debt = { ...existing, settled_amount, updated_at: new Date() };
    await db.debts.put(updated);
    return updated;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.debts.get(id);
    if (existing) {
      await db.debts.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
