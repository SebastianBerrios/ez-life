import { db } from '../db/db';
import { DistributionCategory, ExpenseCategory, ExpenseSubcategory } from '../../core/domain/models/types';

function groupByKey<T>(rows: T[], key: (row: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = groups.get(k);
    if (bucket) bucket.push(row);
    else groups.set(k, [row]);
  }
  return Array.from(groups.values());
}

function survivorAndLosers<T extends { created_at: Date }>(rows: T[]): { survivor: T; losers: T[] } {
  const sorted = [...rows].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const [survivor, ...losers] = sorted;
  return { survivor, losers };
}

// Merges duplicate distribution/expense categories and subcategories that
// accumulated from repeated onboarding runs across devices/sessions (the
// wizard/sync bugs fixed elsewhere this session meant each run's locally-
// seeded default tree never used to sync, so multiple independent copies
// coexisted invisibly and only now converge under the one real account).
// Top-down: distribution categories first, since expense category/subcategory
// duplication is a downstream byproduct of bucket duplication. Every FK on an
// existing Movement is re-pointed to the surviving row before its duplicate
// is soft-deleted — a Movement is never deleted or recreated here.
export async function mergeDuplicateCategories(userId: string): Promise<void> {
  if (!userId) return;

  // 1. Distribution categories, grouped by exact name.
  const buckets = await db.distribution_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
  for (const rows of groupByKey(buckets, b => b.name)) {
    if (rows.length < 2) continue;
    const { survivor, losers } = survivorAndLosers<DistributionCategory>(rows);
    for (const loser of losers) {
      const orphanedExpenseCats = await db.expense_categories.filter(c => c.distribution_category_id === loser.id && !c.deleted_at).toArray();
      for (const cat of orphanedExpenseCats) {
        await db.expense_categories.put({ ...cat, distribution_category_id: survivor.id, updated_at: new Date() });
      }
      const orphanedMovements = await db.movements.filter(m => m.distribution_category_id === loser.id && !m.deleted_at).toArray();
      for (const mov of orphanedMovements) {
        await db.movements.put({ ...mov, distribution_category_id: survivor.id, updated_at: new Date() });
      }
      await db.distribution_categories.put({ ...loser, deleted_at: new Date(), updated_at: new Date() });
    }
  }

  // 2. Expense categories, re-fetched post-remap, grouped by (bucket, name).
  const expenseCats = await db.expense_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
  for (const rows of groupByKey(expenseCats, c => `${c.distribution_category_id}::${c.name}`)) {
    if (rows.length < 2) continue;
    const { survivor, losers } = survivorAndLosers<ExpenseCategory>(rows);
    for (const loser of losers) {
      const orphanedSubs = await db.expense_subcategories.where('category_id').equals(loser.id).filter(s => !s.deleted_at).toArray();
      for (const sub of orphanedSubs) {
        await db.expense_subcategories.put({ ...sub, category_id: survivor.id, updated_at: new Date() });
      }
      const orphanedMovements = await db.movements.filter(m => m.expense_category_id === loser.id && !m.deleted_at).toArray();
      for (const mov of orphanedMovements) {
        await db.movements.put({ ...mov, expense_category_id: survivor.id, updated_at: new Date() });
      }
      await db.expense_categories.put({ ...loser, deleted_at: new Date(), updated_at: new Date() });
    }
  }

  // 3. Expense subcategories, re-fetched post-remap, grouped per surviving
  // category by name (subcategories have no user_id — scope is category_id).
  const survivingCats = await db.expense_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
  for (const cat of survivingCats) {
    const subs = await db.expense_subcategories.where('category_id').equals(cat.id).filter(s => !s.deleted_at).toArray();
    for (const rows of groupByKey(subs, s => s.name)) {
      if (rows.length < 2) continue;
      const { survivor, losers } = survivorAndLosers<ExpenseSubcategory>(rows);
      for (const loser of losers) {
        const orphanedMovements = await db.movements.filter(m => m.expense_subcategory_id === loser.id && !m.deleted_at).toArray();
        for (const mov of orphanedMovements) {
          await db.movements.put({ ...mov, expense_subcategory_id: survivor.id, updated_at: new Date() });
        }
        await db.expense_subcategories.put({ ...loser, deleted_at: new Date(), updated_at: new Date() });
      }
    }
  }
}
