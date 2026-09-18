import { db } from '../db/db';

const USER_SCOPED_TABLES = [
  'income_sources',
  'distribution_categories',
  'expense_categories',
  'savings_goals',
  'movements',
  'notifications',
  'debts',
  'habits',
  'goals',
  'tasks',
] as const;

// Repairs local rows created under a stale/incorrect user_id — the symptom of
// a prior bug where the onboarding wizard minted its own random id instead of
// using the authenticated session's id, orphaning that data from RLS-backed
// sync (Supabase requires user_id === auth.uid()). Re-keys them to the
// current session id via a plain `put()`, which now reliably re-queues them
// for push through the table's own `creating`/`updating` hooks (db.ts's
// dbcore middleware guarantees `sync_queue` is in scope for that write) —
// no need to duplicate the enqueue here.
export async function repairOrphanedLocalRows(correctUserId: string): Promise<void> {
  if (!correctUserId) return;

  for (const tableName of USER_SCOPED_TABLES) {
    const table = db.table(tableName);
    const strayRows = await table.where('user_id').notEqual(correctUserId).toArray();
    for (const row of strayRows) {
      await table.put({ ...row, user_id: correctUserId });
    }
  }

  const strayProfiles = (await db.profiles.toArray()).filter(p => p.id !== correctUserId);
  if (strayProfiles.length > 0) {
    const hasCorrectProfile = await db.profiles.get(correctUserId);
    if (!hasCorrectProfile) {
      await db.profiles.put({ ...strayProfiles[0], id: correctUserId });
    }
    for (const stray of strayProfiles) {
      await db.profiles.delete(stray.id);
    }
  }
}
