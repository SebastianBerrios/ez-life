import { db, type SyncQueueItem } from '../db/db';
import { getSupabaseBrowserClient } from '../supabase/client';
import { emitSyncCompleted } from './syncEvents';
import { fromRemoteRecord, toRemoteRecord } from './recordAdapter';

const tables = [
  'profiles', 'income_sources', 'distribution_categories', 'expense_categories',
  'expense_subcategories', 'savings_goals', 'movement_recurrences', 'movements', 'notifications', 'debts',
  'shared_spaces', 'memberships', 'shared_invites', 'shared_movements', 'habits',
  'achievement_receipts', 'habit_completions', 'goals', 'tasks', 'installment_loans', 'installment_payments',
] as const;
const pageSize = 500;

export class CustomSyncLayer {
  private syncPromise: Promise<void> | null = null;
  sync(): Promise<void> {
    if (!this.syncPromise) this.syncPromise = this.performSync().finally(() => { this.syncPromise = null; });
    return this.syncPromise;
  }
  private async owner(item: SyncQueueItem): Promise<unknown> {
    if (item.table_name === 'profiles') return item.data.id;
    if (item.data.user_id) return item.data.user_id;
    const parent = item.table_name === 'expense_subcategories'
      ? await db.expense_categories.get(String(item.data.category_id))
      : item.table_name === 'habit_completions'
        ? await db.habits.get(String(item.data.habit_id))
        : item.table_name === 'installment_payments'
          ? await db.installment_loans.get(String(item.data.installment_loan_id)) : undefined;
    return parent?.user_id;
  }
  private async performSync(): Promise<void> {
    if (!navigator.onLine) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;
    const sameSession = async () => (await supabase.auth.getSession()).data.session?.user.id === userId;
    try {
      for (const tableName of tables) {
        const records: Record<string, unknown>[] = [];
        let afterId: string | undefined;
        while (true) {
          let query = supabase.from(tableName).select('*').order('id').limit(pageSize);
          if (afterId) query = query.gt('id', afterId);
          const { data, error } = await query;
          if (!await sameSession()) return;
          if (error) throw new Error(`Pull ${tableName}: ${error.message}`);
          const page = (data ?? []).map(fromRemoteRecord);
          records.push(...page);
          if (page.length < pageSize) break;
          afterId = String(page[page.length - 1].id);
        }
        await db.applyRemoteRecords(tableName, records);
      }
      const pending = await db.sync_queue.orderBy('created_at').toArray();
      const latest = new Map<string, SyncQueueItem>();
      for (const item of pending) {
        if (await this.owner(item) !== userId) continue;
        latest.set(`${item.table_name}:${item.data.id}`, item);
      }
      const ordered = [...latest.values()].sort((a, b) => tables.indexOf(a.table_name as typeof tables[number]) - tables.indexOf(b.table_name as typeof tables[number]));
      for (const item of ordered) {
        if (!await sameSession()) return;
        // IndexedDB is authoritative even when two writes share a clock tick.
        // Queue ordering alone cannot disambiguate snapshots with equal dates.
        const current = await db.table(item.table_name).get(String(item.data.id));
        const { error } = await supabase.rpc('sync_record', {
          table_name: item.table_name, payload: toRemoteRecord(current ?? item.data, item.table_name),
        });
        if (error) { console.error(`Push ${item.table_name}:`, error); continue; }
        // Confirm only snapshots captured before sending. Concurrent edits
        // have new queue IDs and remain pending, even at equal timestamps.
        const ids = pending.filter(previous => previous.table_name === item.table_name && previous.data.id === item.data.id).map(previous => previous.id);
        await db.sync_queue.bulkDelete(ids);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally { emitSyncCompleted(); }
  }
}
export const sessionSync = new CustomSyncLayer();
