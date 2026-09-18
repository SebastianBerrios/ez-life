import { db } from '../db/db';
import { DistributionCategory } from '../../core/domain/models/types';

// Mirrors OnboardingWizard's pickSeedBuckets "primary" selection (highest-
// percentage non-savings bucket) — duplicated here rather than imported
// because that function lives in presentation, which infrastructure must
// never depend on (Principio III).
function pickFallbackBucketId(buckets: DistributionCategory[]): string | undefined {
  const nonSavings = [...buckets].filter(b => !b.is_savings).sort((a, b) => b.percentage - a.percentage);
  return nonSavings[0]?.id ?? buckets[0]?.id;
}

// Repairs ExpenseCategory rows whose distribution_category_id is missing or
// dangling (points at no active bucket) — a historical seeding bug where
// OnboardingWizard's pickSeedBuckets fell back to '' when it ran before this
// device's distribution_categories had finished seeding. These broken rows
// never used to reach Supabase (the sync_queue bug fixed elsewhere this
// session silently dropped every push), so they sat invisibly in local
// IndexedDB. Now that push actually works, Postgres correctly rejects the
// NOT NULL violation, which then cascades into an RLS failure on that same
// category's own subcategories (their policy requires the parent to already
// exist remotely). This assigns a fallback bucket and re-touches the
// category's active subcategories afterward so their sync_queue retry (which
// CustomSyncLayer processes in created_at order) lands after the parent's
// fix within the same push pass.
//
// Scans BOTH active and already-soft-deleted expense_categories: a duplicate
// with a dangling bucket id can itself become a "loser" in
// mergeDuplicateCategories (soft-deleted there), which only stamps
// deleted_at/updated_at and never touches other fields — so its invalid
// distribution_category_id survives the merge untouched. Postgres enforces
// NOT NULL regardless of deleted_at (a soft delete is an app-level flag, not
// a real row deletion), so a deleted-but-never-yet-synced row still needs a
// valid FK to push at all. Fixing it here must never clear its deleted_at —
// only the FK is repaired, the row stays deleted.
export async function repairDanglingExpenseCategories(userId: string): Promise<void> {
  if (!userId) return;

  const buckets = await db.distribution_categories.where('user_id').equals(userId).filter(c => !c.deleted_at).toArray();
  const validBucketIds = new Set(buckets.map(b => b.id));
  const fallbackBucketId = pickFallbackBucketId(buckets);
  if (!fallbackBucketId) return; // nothing safe to assign — leave as-is rather than guessing

  const expenseCats = await db.expense_categories.where('user_id').equals(userId).toArray();

  for (const cat of expenseCats) {
    if (cat.distribution_category_id && validBucketIds.has(cat.distribution_category_id)) continue;

    await db.expense_categories.put({ ...cat, distribution_category_id: fallbackBucketId, updated_at: new Date() });

    // A soft-deleted category's active subcategories were already remapped
    // away by mergeDuplicateCategories before it became a loser — nothing
    // left underneath it to re-touch, so this only ever does real work for
    // an active category.
    if (cat.deleted_at) continue;

    const subs = await db.expense_subcategories.where('category_id').equals(cat.id).filter(s => !s.deleted_at).toArray();
    for (const sub of subs) {
      await db.expense_subcategories.put({ ...sub, updated_at: new Date() });
    }
  }
}
