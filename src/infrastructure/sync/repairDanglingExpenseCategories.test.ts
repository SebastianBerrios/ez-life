import { describe, it, expect, beforeEach } from 'vitest';
import { repairDanglingExpenseCategories } from './repairDanglingExpenseCategories';
import { db } from '../db/db';

const userId = 'real-session-id';
const t0 = new Date('2026-01-01T00:00:00Z');

describe('repairDanglingExpenseCategories', () => {
  beforeEach(async () => {
    await db.distribution_categories.clear();
    await db.expense_categories.clear();
    await db.expense_subcategories.clear();
    await db.movements.clear();
    await db.sync_queue.clear();

    // Valid bucket set: Necesidades (50%, primary by percentage), Gustos (30%), Ahorro (savings).
    await db.distribution_categories.bulkPut([
      { id: 'nb1', user_id: userId, name: 'Necesidades Básicas', percentage: 50, is_default: true, is_savings: false, created_at: t0, updated_at: t0 },
      { id: 'gd1', user_id: userId, name: 'Gustos y Deseos', percentage: 30, is_default: true, is_savings: false, created_at: t0, updated_at: t0 },
      { id: 'ai1', user_id: userId, name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true, created_at: t0, updated_at: t0 },
    ]);

    await db.expense_categories.bulkPut([
      // Broken: empty string distribution_category_id (the historical pickSeedBuckets('') landmine).
      { id: 'catEmpty', user_id: userId, distribution_category_id: '', name: 'Alimentación', created_at: t0, updated_at: t0 },
      // Broken: dangling id pointing at nothing that exists.
      { id: 'catDangling', user_id: userId, distribution_category_id: 'does-not-exist', name: 'Ocio', created_at: t0, updated_at: t0 },
      // Healthy: already valid, must be left untouched.
      { id: 'catHealthy', user_id: userId, distribution_category_id: 'gd1', name: 'Transporte', created_at: t0, updated_at: t0 },
      // Broken AND already soft-deleted — a loser from mergeDuplicateCategories
      // that carried its original invalid distribution_category_id forward.
      // Still needs a valid FK to satisfy Postgres NOT NULL on push, even
      // though it must never be resurrected.
      { id: 'catDeletedDangling', user_id: userId, distribution_category_id: '', name: 'Alimentación', created_at: t0, updated_at: t0, deleted_at: t0 },
    ]);

    await db.expense_subcategories.bulkPut([
      { id: 'subEmpty', category_id: 'catEmpty', name: 'Desayuno', created_at: t0, updated_at: t0 },
      { id: 'subDangling', category_id: 'catDangling', name: 'Cine', created_at: t0, updated_at: t0 },
      { id: 'subHealthy', category_id: 'catHealthy', name: 'Bus', created_at: t0, updated_at: t0 },
    ]);

    await db.movements.bulkPut([
      { id: 'movEmpty', user_id: userId, type: 'EXPENSE', amount: 100, date: t0, is_recurring: false, expense_category_id: 'catEmpty', expense_subcategory_id: 'subEmpty', created_at: t0, updated_at: t0 },
      { id: 'movDangling', user_id: userId, type: 'EXPENSE', amount: 200, date: t0, is_recurring: false, expense_category_id: 'catDangling', expense_subcategory_id: 'subDangling', created_at: t0, updated_at: t0 },
    ]);

    await db.sync_queue.clear(); // ignore enqueues from fixture setup itself
  });

  it('assigns the fallback bucket (highest-percentage non-savings) to a category with an empty distribution_category_id', async () => {
    await repairDanglingExpenseCategories(userId);

    const cat = await db.expense_categories.get('catEmpty');
    expect(cat?.distribution_category_id).toBe('nb1');
  });

  it('assigns the fallback bucket to a category whose distribution_category_id points at nothing', async () => {
    await repairDanglingExpenseCategories(userId);

    const cat = await db.expense_categories.get('catDangling');
    expect(cat?.distribution_category_id).toBe('nb1');
  });

  it('leaves an already-valid category completely untouched', async () => {
    const before = await db.expense_categories.get('catHealthy');

    await repairDanglingExpenseCategories(userId);

    const after = await db.expense_categories.get('catHealthy');
    expect(after?.distribution_category_id).toBe('gd1');
    expect(after?.updated_at).toEqual(before?.updated_at);
  });

  it('re-touches active subcategories of a repaired category, bumping updated_at without changing any other field', async () => {
    const subBefore = await db.expense_subcategories.get('subEmpty');

    await repairDanglingExpenseCategories(userId);

    const subAfter = await db.expense_subcategories.get('subEmpty');
    expect(subAfter?.name).toBe(subBefore?.name);
    expect(subAfter?.category_id).toBe(subBefore?.category_id);
    expect(subAfter?.updated_at.getTime()).toBeGreaterThan(subBefore!.updated_at.getTime());
  });

  it('never touches, deletes, or re-points any Movement — only the category itself is fixed', async () => {
    const movBefore = await db.movements.get('movEmpty');

    await repairDanglingExpenseCategories(userId);

    const movAfter = await db.movements.get('movEmpty');
    expect(movAfter).toEqual(movBefore);
  });

  it('queues the repaired category and its subcategory for sync via the existing dbcore/hook mechanism', async () => {
    await repairDanglingExpenseCategories(userId);

    const queue = await db.sync_queue.toArray();
    const queuedIds = new Set(queue.map(item => (item.data as { id?: string }).id));
    expect(queuedIds.has('catEmpty')).toBe(true);
    expect(queuedIds.has('subEmpty')).toBe(true);
  });

  it('assigns the fallback bucket to an already soft-deleted category without resurrecting it', async () => {
    await repairDanglingExpenseCategories(userId);

    const cat = await db.expense_categories.get('catDeletedDangling');
    expect(cat?.distribution_category_id).toBe('nb1');
    expect(cat?.deleted_at).toEqual(t0);
    expect(cat?.updated_at.getTime()).toBeGreaterThan(t0.getTime());
  });

  it('queues a repaired soft-deleted category for sync so its stale bad snapshot gets superseded', async () => {
    await repairDanglingExpenseCategories(userId);

    const queue = await db.sync_queue.toArray();
    const queuedIds = new Set(queue.map(item => (item.data as { id?: string }).id));
    expect(queuedIds.has('catDeletedDangling')).toBe(true);
  });

  it('is idempotent — running it again once everything is valid is a no-op', async () => {
    await repairDanglingExpenseCategories(userId);
    const afterFirst = await db.expense_categories.get('catEmpty');

    await repairDanglingExpenseCategories(userId);
    const afterSecond = await db.expense_categories.get('catEmpty');

    expect(afterSecond?.updated_at).toEqual(afterFirst?.updated_at);
  });
});
