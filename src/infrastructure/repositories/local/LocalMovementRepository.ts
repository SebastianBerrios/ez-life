import { db } from '../../db/db';
import { IMovementRepository } from '../../../core/domain/repositories/IRepositories';
import { Movement, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';
import { validateMovementAmount } from '../../../core/use-cases/validateMovementAmount';
import { validateBalanceAdjustment } from '../../../core/use-cases/validateBalanceAdjustment';
import { validateTransfer } from '../../../core/use-cases/validateTransfer';
import { DomainError } from '../../../core/domain/errors/DomainError';

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
    validateMovementAmount(data.amount);
    validateBalanceAdjustment(data);
    if (!Number.isFinite(data.date.getTime())) throw new DomainError('La fecha no es válida.');
    return db.transaction('rw', [db.movements, db.distribution_categories, db.expense_categories,
      db.expense_subcategories, db.income_sources, db.savings_goals, db.payment_accounts, db.movement_recurrences, db.sync_queue], async () => {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.movements.get(id);
    if (existing && existing.user_id !== data.user_id) throw new DomainError('El movimiento pertenece a otra cuenta.');
    if (existing?.is_linked || existing?.shared_movement_id || existing?.installment_payment_id) throw new DomainError('Editá este movimiento desde su operación de origen.');
    if (existing?.deleted_at) throw new DomainError('El movimiento fue eliminado.');
    validateTransfer({ ...(existing ?? {}), ...data });
    for (const accountId of [data.account_id, data.to_account_id]) {
      if (!accountId) continue;
      const account = await db.payment_accounts.get(accountId);
      if (!account || account.deleted_at || account.user_id !== data.user_id) throw new DomainError('La cuenta no es válida.');
    }
    const bucket = data.distribution_category_id ? await db.distribution_categories.get(data.distribution_category_id) : undefined;
    const category = data.expense_category_id ? await db.expense_categories.get(data.expense_category_id) : undefined;
    const subcategory = data.expense_subcategory_id ? await db.expense_subcategories.get(data.expense_subcategory_id) : undefined;
    const source = data.income_source_id ? await db.income_sources.get(data.income_source_id) : undefined;
    const goal = data.savings_goal_id ? await db.savings_goals.get(data.savings_goal_id) : undefined;
    if (data.distribution_category_id && (!bucket || bucket.deleted_at || bucket.user_id !== data.user_id)) throw new DomainError('La distribución no es válida.');
    if (data.expense_category_id && (!category || category.deleted_at || category.user_id !== data.user_id || category.distribution_category_id !== bucket?.id)) throw new DomainError('La categoría no pertenece a esta distribución.');
    if (data.expense_subcategory_id && (!subcategory || subcategory.deleted_at || subcategory.category_id !== category?.id)) throw new DomainError('La subcategoría no pertenece a esta categoría.');
    if (data.income_source_id && (!source || source.deleted_at || source.user_id !== data.user_id)) throw new DomainError('La fuente de ingreso no es válida.');
    if (data.savings_goal_id && (!goal || goal.deleted_at || goal.user_id !== data.user_id || !bucket?.is_savings || data.type !== 'EXPENSE' || data.is_adjustment)) throw new DomainError('El aporte requiere una meta propia y el bucket de ahorro.');
    if (data.type === 'INCOME' && !data.is_adjustment && !source) throw new DomainError('Seleccioná una fuente de ingreso.');
    if (data.type === 'EXPENSE' && !data.is_adjustment && !bucket) throw new DomainError('Seleccioná una distribución.');
    if (data.type === 'EXPENSE' && !data.is_adjustment && !category) throw new DomainError('Seleccioná una categoría de gasto.');
    
    const movement: Movement = existing 
      ? { ...existing, ...data, id, updated_at: now }
      : { ...data, id, created_at: now, updated_at: now };

    // Occurrences are independent. Only the source movement's checkbox edits
    // the rule; changing/deleting a generated occurrence never changes it.
    if (!existing?.recurrence_rule_id || existing.recurrence_rule_id === id) {
      const rule = await db.movement_recurrences.get(id);
      if (data.is_recurring) {
        const activated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        movement.recurrence_rule_id = id;
        movement.recurrence_month = `${data.date.getFullYear()}-${String(data.date.getMonth() + 1).padStart(2, '0')}`;
        await db.movement_recurrences.put({ ...movement, id, active: true,
          day_of_month: data.date.getDate(), activated_month: rule?.active ? rule.activated_month : activated,
        });
      } else if (rule) {
        await db.movement_recurrences.put({ ...rule, active: false, updated_at: now });
      }
    }
      
    await db.movements.put(movement);
    return movement;
    });
  }

  async delete(id: UUID, userId?: UUID): Promise<void> {
    const existing = await db.movements.get(id);
    if (existing) {
      if (userId && existing.user_id !== userId) throw new DomainError('El movimiento pertenece a otra cuenta.');
      if (existing.is_linked || existing.shared_movement_id || existing.installment_payment_id) throw new DomainError('Eliminá este movimiento desde su operación de origen.');
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
