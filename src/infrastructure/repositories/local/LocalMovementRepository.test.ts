import { beforeEach, it, expect } from 'vitest';
import { db } from '../../db/db';
import { LocalMovementRepository } from './LocalMovementRepository';
import { LocalIncomeSourceRepository } from './LocalIncomeSourceRepository';
const now = new Date(2026, 9, 8);
const base = { id: '', user_id: 'A', type: 'EXPENSE' as const, amount: 100, date: now, is_recurring: false, distribution_category_id: 'bucket', expense_category_id: 'category' };
beforeEach(async () => {
  await db.delete(); await db.open();
  await db.distribution_categories.put({ id: 'bucket', user_id: 'A', name: 'Ahorro', percentage: 100, is_default: true, is_savings: true, created_at: now, updated_at: now });
  await db.expense_categories.put({ id: 'category', user_id: 'A', distribution_category_id: 'bucket', name: 'Comida', created_at: now, updated_at: now });
});
it('validates money and adjustment motives in the repository', async () => {
  const repo = new LocalMovementRepository();
  await expect(repo.save({ ...base, amount: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
  await expect(repo.save({ ...base, is_adjustment: true, distribution_category_id: undefined, description: ' ' })).rejects.toThrow();
  expect(await db.movements.count()).toBe(0);
});
it('blocks ownership changes, invalid relationships and direct edits/deletes of linked movements', async () => {
  const repo = new LocalMovementRepository(); const saved = await repo.save(base);
  await expect(repo.save({ ...saved, user_id: 'B' })).rejects.toThrow(/otra cuenta/);
  await expect(repo.save({ ...base, expense_subcategory_id: 'foreign' })).rejects.toThrow();
  await db.movements.put({ ...saved, is_linked: true });
  await expect(repo.save(saved)).rejects.toThrow(/origen/); await expect(repo.delete(saved.id, 'A')).rejects.toThrow(/origen/);
});
it('requires an owned source for income and prevents deleting associated sources', async () => {
  const income = new LocalIncomeSourceRepository(); const source = await income.save({ id: '', user_id: 'A', name: 'Sueldo', amount: 10000 });
  const repo = new LocalMovementRepository();
  await expect(repo.save({ ...base, type: 'INCOME', distribution_category_id: undefined, expense_category_id: undefined })).rejects.toThrow(/fuente/);
  await repo.save({ ...base, type: 'INCOME', distribution_category_id: undefined, expense_category_id: undefined, income_source_id: source.id });
  await expect(income.delete(source.id)).rejects.toThrow(/asociados/);
});
