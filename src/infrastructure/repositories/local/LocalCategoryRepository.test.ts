import { beforeEach, it, expect, vi } from 'vitest';
import { db } from '../../db/db';
import { LocalCategoryRepository } from './LocalCategoryRepository';
const repo = new LocalCategoryRepository();
const rows = [
  { id: 'a', user_id: 'A', name: 'Gastos', percentage: 80, is_default: true, is_savings: false },
  { id: 'b', user_id: 'A', name: 'Ahorro', percentage: 20, is_default: true, is_savings: true },
];
beforeEach(async () => { vi.restoreAllMocks(); await db.delete(); await db.open(); await repo.saveDistributionSet('A', rows); });
it('rejects foreign categories and blank initial subcategories, and protects the last subcategory', async () => {
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'B', distribution_category_id: 'a', name: 'Comida' }, ['Mercado'])).rejects.toThrow();
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: '  ' })).rejects.toThrow();
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' }, ['  '])).rejects.toThrow();
  const category = await repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' }, ['Mercado']);
  const subs = await repo.getSubcategories(category.id);
  await expect(repo.deleteSubcategory(subs[0].id)).rejects.toThrow(/al menos una/);
  await expect(repo.deleteDistributionCategory('a')).rejects.toThrow(/asociados/);
  await expect(repo.deleteDistributionCategory('b')).rejects.toThrow(/ahorro/);
});
it('creates a category without any subcategory (no default "General")', async () => {
  const category = await repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' });
  expect(category.name).toBe('Comida');
  expect(await repo.getSubcategories('c')).toEqual([]);
  // It can later receive its first subcategory, and then that one is protected.
  const sub = await repo.saveSubcategory({ id: 's', category_id: 'c', name: 'Mercado' });
  await expect(repo.deleteSubcategory(sub.id)).rejects.toThrow(/al menos una/);
});
it('uses plain wording (no "bucket") in the category creation errors', async () => {
  await expect(repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'missing', name: 'Comida' }))
    .rejects.toThrow('La categoría requiere nombre y una categoría de distribución propia.');
});
it('lists categories in creation order: a newer category goes last even if its id sorts first', async () => {
  await repo.saveExpenseCategory({ id: 'zzz', user_id: 'A', distribution_category_id: 'a', name: 'Primera' });
  await repo.saveExpenseCategory({ id: 'mmm', user_id: 'A', distribution_category_id: 'a', name: 'Segunda' });
  await repo.saveExpenseCategory({ id: 'aaa', user_id: 'A', distribution_category_id: 'a', name: 'Tercera' });
  expect((await repo.getExpenseCategories('A')).map(row => row.name)).toEqual(['Primera', 'Segunda', 'Tercera']);
});
it('lists subcategories in creation order, newest at the end', async () => {
  await repo.saveExpenseCategory({ id: 'c', user_id: 'A', distribution_category_id: 'a', name: 'Comida' });
  await repo.saveSubcategory({ id: 'zzz', category_id: 'c', name: 'Mercado' });
  await repo.saveSubcategory({ id: 'aaa', category_id: 'c', name: 'Restaurantes' });
  expect((await repo.getSubcategories('c')).map(row => row.name)).toEqual(['Mercado', 'Restaurantes']);
});
it('keeps the order of the seeded categories and subcategories', async () => {
  await repo.seedDefaults('A');
  const categories = await repo.getExpenseCategories('A');
  expect(categories.map(row => row.name)).toEqual(['Alimentación', 'Ocio', 'Transporte', 'Ahorro']);
  expect((await repo.getSubcategories(categories[0].id)).map(row => row.name)).toEqual(['Desayuno', 'Almuerzo', 'Cena', 'Snack']);
  expect((await repo.getSubcategories(categories[2].id)).map(row => row.name)).toEqual(['Combustible', 'Taxi/Uber', 'Transporte público']);
});
it('lists a legacy category that already has "General" untouched, with new subcategories after it', async () => {
  const old = new Date(2026, 0, 1);
  await db.expense_categories.put({ id: 'legacy', user_id: 'A', distribution_category_id: 'a', name: 'Antigua', created_at: old, updated_at: old });
  await db.expense_subcategories.put({ id: 'zzz-general', category_id: 'legacy', name: 'General', created_at: old, updated_at: old });
  await repo.saveSubcategory({ id: 'aaa-new', category_id: 'legacy', name: 'Nueva' });
  const subs = await repo.getSubcategories('legacy');
  expect(subs.map(row => row.name)).toEqual(['General', 'Nueva']);
  expect(subs[0].updated_at).toEqual(old);
  expect((await repo.getExpenseCategories('A')).map(row => row.name)).toEqual(['Antigua']);
});
it('accepts a 0% savings category but rejects 0% on any other category', async () => {
  const saved = await repo.saveDistributionCategory({ id: 'b', user_id: 'A', name: 'Ahorro', percentage: 0, is_default: true, is_savings: true });
  expect(saved.percentage).toBe(0);
  await expect(repo.saveDistributionCategory({ id: 'a', user_id: 'A', name: 'Gastos', percentage: 0, is_default: true, is_savings: false })).rejects.toThrow();
  await expect(repo.saveDistributionCategory({ id: 'z', user_id: 'A', name: 'Nueva', percentage: 101, is_default: false, is_savings: false })).rejects.toThrow();
});
it('persists a complete distribution whose savings category is at 0%', async () => {
  await repo.saveDistributionSet('A', [{ ...rows[0], percentage: 100 }, { ...rows[1], percentage: 0 }]);
  expect((await repo.getDistributionCategories('A')).map(row => row.percentage).sort((x, y) => x - y)).toEqual([0, 100]);
});
it('keeps refusing to delete the savings category or the only distribution category, with plain wording', async () => {
  await expect(repo.deleteDistributionCategory('b')).rejects.toThrow('No se puede eliminar la categoría de ahorro ni la única categoría de distribución.');
  await expect(repo.saveDistributionCategory({ ...rows[1], percentage: 20, is_savings: false })).rejects.toThrow('No se puede desmarcar la única categoría de ahorro.');
});
it('rolls back a complete distribution save if any write fails', async () => {
  const put = db.distribution_categories.put.bind(db.distribution_categories);
  vi.spyOn(db.distribution_categories, 'put').mockImplementation(row => row.id === 'b' ? Promise.reject(new Error('failure')) as ReturnType<typeof put> : put(row));
  await expect(repo.saveDistributionSet('A', rows.map(row => ({ ...row, percentage: 50 })))).rejects.toThrow();
  expect((await repo.getDistributionCategories('A')).map(row => row.percentage)).toEqual([80, 20]);
});
