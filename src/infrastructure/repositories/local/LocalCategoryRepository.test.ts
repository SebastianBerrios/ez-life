import { beforeEach, it, expect, vi } from 'vitest';
import { db } from '../../db/db';
import { LocalCategoryRepository } from './LocalCategoryRepository';
const repo = new LocalCategoryRepository();
const rows = [
  { id: 'a', user_id: 'A', name: 'Gastos', percentage: 80, is_default: true, is_savings: false },
  { id: 'b', user_id: 'A', name: 'Ahorro', percentage: 20, is_default: true, is_savings: true },
];
beforeEach(async () => { vi.restoreAllMocks(); await db.delete(); await db.open(); await repo.saveDistributionSet('A', rows); });
it('rejects incomplete and foreign categories and protects the last subcategory', async () => {
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' })).rejects.toThrow();
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'B', distribution_category_id: 'a', name: 'Comida' }, ['General'])).rejects.toThrow();
  const category = await repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' }, ['General']);
  const subs = await repo.getSubcategories(category.id);
  await expect(repo.deleteSubcategory(subs[0].id)).rejects.toThrow(/al menos una/);
  await expect(repo.deleteDistributionCategory('a')).rejects.toThrow(/asociados/);
  await expect(repo.deleteDistributionCategory('b')).rejects.toThrow(/ahorro/);
});
it('rolls back a complete distribution save if any write fails', async () => {
  const put = db.distribution_categories.put.bind(db.distribution_categories);
  vi.spyOn(db.distribution_categories, 'put').mockImplementation(row => row.id === 'b' ? Promise.reject(new Error('failure')) as ReturnType<typeof put> : put(row));
  await expect(repo.saveDistributionSet('A', rows.map(row => ({ ...row, percentage: 50 })))).rejects.toThrow();
  expect((await repo.getDistributionCategories('A')).map(row => row.percentage)).toEqual([80, 20]);
});
