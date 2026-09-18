import { describe, it, expect, beforeEach } from 'vitest';
import { mergeDuplicateCategories } from './mergeDuplicateCategories';
import { db } from '../db/db';

const userId = 'real-session-id';
const t0 = new Date('2026-01-01T00:00:00Z');
const t1 = new Date('2026-02-01T00:00:00Z');

describe('mergeDuplicateCategories', () => {
  beforeEach(async () => {
    await db.distribution_categories.clear();
    await db.expense_categories.clear();
    await db.expense_subcategories.clear();
    await db.movements.clear();
    await db.sync_queue.clear();

    // Two full duplicate trees (nb1/gd1/ai1 older, nb2/gd2/ai2 newer) plus a
    // non-duplicated bucket-scoped category (catT/subT) to prove untouched
    // rows are left alone.
    await db.distribution_categories.bulkPut([
      { id: 'nb1', user_id: userId, name: 'Necesidades Básicas', percentage: 50, is_default: true, is_savings: false, created_at: t0, updated_at: t0 },
      { id: 'nb2', user_id: userId, name: 'Necesidades Básicas', percentage: 50, is_default: true, is_savings: false, created_at: t1, updated_at: t1 },
      { id: 'gd1', user_id: userId, name: 'Gustos y Deseos', percentage: 30, is_default: true, is_savings: false, created_at: t0, updated_at: t0 },
      { id: 'gd2', user_id: userId, name: 'Gustos y Deseos', percentage: 30, is_default: true, is_savings: false, created_at: t1, updated_at: t1 },
      { id: 'ai1', user_id: userId, name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true, created_at: t0, updated_at: t0 },
      { id: 'ai2', user_id: userId, name: 'Ahorro e Inversión', percentage: 20, is_default: true, is_savings: true, created_at: t1, updated_at: t1 },
    ]);

    await db.expense_categories.bulkPut([
      { id: 'catA', user_id: userId, distribution_category_id: 'nb1', name: 'Alquiler', created_at: t0, updated_at: t0 },
      { id: 'catB', user_id: userId, distribution_category_id: 'nb2', name: 'Alquiler', created_at: t1, updated_at: t1 },
      { id: 'catT', user_id: userId, distribution_category_id: 'nb1', name: 'Transporte', created_at: t0, updated_at: t0 },
    ]);

    await db.expense_subcategories.bulkPut([
      { id: 'subA', category_id: 'catA', name: 'Renta', created_at: t0, updated_at: t0 },
      { id: 'subB', category_id: 'catB', name: 'Renta', created_at: t1, updated_at: t1 },
      { id: 'subT', category_id: 'catT', name: 'Bus', created_at: t0, updated_at: t0 },
    ]);

    await db.movements.bulkPut([
      { id: 'mov1', user_id: userId, type: 'EXPENSE', amount: 100, date: t1, is_recurring: false, distribution_category_id: 'nb2', created_at: t1, updated_at: t1 },
      { id: 'mov2', user_id: userId, type: 'EXPENSE', amount: 200, date: t1, is_recurring: false, distribution_category_id: 'nb2', expense_category_id: 'catB', created_at: t1, updated_at: t1 },
      { id: 'mov3', user_id: userId, type: 'EXPENSE', amount: 300, date: t1, is_recurring: false, distribution_category_id: 'nb2', expense_category_id: 'catB', expense_subcategory_id: 'subB', created_at: t1, updated_at: t1 },
    ]);

    await db.sync_queue.clear(); // ignore enqueues from fixture setup itself
  });

  it('collapses duplicate distribution categories, keeping the earliest-created row per name', async () => {
    await mergeDuplicateCategories(userId);

    const active = await db.distribution_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
    expect(active.map(c => c.id).sort()).toEqual(['ai1', 'gd1', 'nb1']);

    const nb2 = await db.distribution_categories.get('nb2');
    expect(nb2?.deleted_at).toBeInstanceOf(Date);
  });

  it('collapses duplicate expense categories within a merged bucket, keeping the earliest, and leaves non-duplicates untouched', async () => {
    await mergeDuplicateCategories(userId);

    const active = await db.expense_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
    expect(active.map(c => c.id).sort()).toEqual(['catA', 'catT']);

    const catA = await db.expense_categories.get('catA');
    expect(catA?.distribution_category_id).toBe('nb1');

    const catB = await db.expense_categories.get('catB');
    expect(catB?.deleted_at).toBeInstanceOf(Date);
  });

  it('collapses duplicate subcategories within a merged category, keeping the earliest, and leaves non-duplicates untouched', async () => {
    await mergeDuplicateCategories(userId);

    const subA = await db.expense_subcategories.get('subA');
    expect(subA?.deleted_at).toBeUndefined();

    const subB = await db.expense_subcategories.get('subB');
    expect(subB?.deleted_at).toBeInstanceOf(Date);

    const subT = await db.expense_subcategories.get('subT');
    expect(subT?.deleted_at).toBeUndefined();
  });

  it('re-points every movement FK to the surviving row, never to a soft-deleted one, without ever changing which bucket/category it resolves to', async () => {
    await mergeDuplicateCategories(userId);

    const mov1 = await db.movements.get('mov1');
    expect(mov1?.distribution_category_id).toBe('nb1');

    const mov2 = await db.movements.get('mov2');
    expect(mov2?.distribution_category_id).toBe('nb1');
    expect(mov2?.expense_category_id).toBe('catA');

    const mov3 = await db.movements.get('mov3');
    expect(mov3?.distribution_category_id).toBe('nb1');
    expect(mov3?.expense_category_id).toBe('catA');
    expect(mov3?.expense_subcategory_id).toBe('subA');

    // None of the movements' final FKs may point at a soft-deleted row.
    for (const mov of [mov1, mov2, mov3]) {
      if (mov?.distribution_category_id) {
        const cat = await db.distribution_categories.get(mov.distribution_category_id);
        expect(cat?.deleted_at).toBeUndefined();
      }
      if (mov?.expense_category_id) {
        const cat = await db.expense_categories.get(mov.expense_category_id);
        expect(cat?.deleted_at).toBeUndefined();
      }
      if (mov?.expense_subcategory_id) {
        const sub = await db.expense_subcategories.get(mov.expense_subcategory_id);
        expect(sub?.deleted_at).toBeUndefined();
      }
    }
  });

  it('queues the soft-deleted losers for sync via the existing dbcore/hook mechanism', async () => {
    await mergeDuplicateCategories(userId);

    const queue = await db.sync_queue.toArray();
    const queuedIds = new Set(queue.map(item => (item.data as { id?: string }).id));
    expect(queuedIds.has('nb2')).toBe(true);
    expect(queuedIds.has('catB')).toBe(true);
    expect(queuedIds.has('subB')).toBe(true);
  });

  it('is idempotent — running it again with nothing left to merge is a no-op', async () => {
    await mergeDuplicateCategories(userId);
    const activeBefore = await db.distribution_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();

    await mergeDuplicateCategories(userId);
    const activeAfter = await db.distribution_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();

    expect(activeAfter.map(c => c.id).sort()).toEqual(activeBefore.map(c => c.id).sort());
  });
});
