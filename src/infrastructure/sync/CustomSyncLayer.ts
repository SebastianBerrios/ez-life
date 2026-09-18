import { db, type SyncQueueItem } from '../db/db';
import { getSupabaseBrowserClient } from '../supabase/client';
import { emitSyncCompleted } from './syncEvents';

const supabase = getSupabaseBrowserClient();

export class CustomSyncLayer {
  // A concurrent caller must await the SAME in-flight cycle rather than
  // getting an immediately-resolved no-op — otherwise a caller that needs to
  // know sync actually finished (e.g. "does this device need onboarding?")
  // can race ahead of a cycle kicked off elsewhere and read stale local data.
  private syncPromise: Promise<void> | null = null;

  async sync(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.performSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async performSync(): Promise<void> {
    try {
      // 1. Pull: Obtener cambios remotos
      const lastSyncStr = localStorage.getItem('last_sync') || new Date(0).toISOString();
      const lastSyncDate = new Date(lastSyncStr);

      const tablesToSync = [
        'profiles', 'income_sources', 'distribution_categories',
        'expense_categories', 'expense_subcategories', 'savings_goals', 'movements',
        'notifications', 'debts', 'shared_spaces', 'memberships', 'shared_invites',
        'shared_movements', 'habits', 'habit_completions', 'goals', 'tasks'
      ];

      for (const tableName of tablesToSync) {
        // Pull
        const { data: remoteData, error } = await supabase
          .from(tableName)
          .select('*')
          .gt('updated_at', lastSyncDate.toISOString());

        if (error) {
          console.error(`Error pulling from ${tableName}:`, error);
          continue;
        }

        // Resolve conflicts (Last-Write-Wins, with local tombstones protected)
        if (remoteData && remoteData.length > 0) {
          const localTable = db.table(tableName);
          for (const remoteRecord of remoteData) {
            const localRecord = await localTable.get(remoteRecord.id);

            if (!localRecord) {
              await localTable.put(remoteRecord);
              continue;
            }

            const remoteIsNewer = new Date(remoteRecord.updated_at) > new Date(localRecord.updated_at);
            if (!remoteIsNewer) continue;

            // A local tombstone that hasn't been reflected remotely yet must not be
            // resurrected by a stale (pre-delete) remote copy, even if that remote
            // copy has a newer updated_at.
            const localIsTombstone = Boolean((localRecord as { deleted_at?: Date }).deleted_at);
            const remoteIsTombstone = Boolean((remoteRecord as { deleted_at?: Date }).deleted_at);
            if (localIsTombstone && !remoteIsTombstone) continue;

            await localTable.put(remoteRecord); // Remote wins
          }
        }
      }

      // 2. Push: Subir cambios pendientes locales
      const pendingQueue = await db.sync_queue.orderBy('created_at').toArray();
      let pushHadErrors = false;

      // Each queue entry is a full snapshot, not a diff, keyed by its own
      // random id rather than the source row's id — so a row updated twice
      // before its first snapshot pushes ends up with two+ queue entries.
      // Keep only the newest snapshot per (table, row id): it already is
      // the complete authoritative state, so an older superseded entry is
      // discarded unconditionally, even if it was the one that kept failing
      // (e.g. a since-corrected bad value that would otherwise retry forever).
      const latestByRow = new Map<string, SyncQueueItem>();
      for (const item of pendingQueue) {
        const key = `${item.table_name}:${item.data.id}`;
        const existing = latestByRow.get(key);
        if (!existing || item.created_at > existing.created_at) latestByRow.set(key, item);
      }
      const supersededIds = pendingQueue
        .filter(item => latestByRow.get(`${item.table_name}:${item.data.id}`)?.id !== item.id)
        .map(item => item.id);
      if (supersededIds.length > 0) {
        await db.sync_queue.bulkDelete(supersededIds);
      }
      const dedupedQueue = Array.from(latestByRow.values()).sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime()
      );

      for (const item of dedupedQueue) {
        // `profiles` can only ever be created remotely by the enroll_self()
        // RPC (Principio IX) — a client `.upsert()` always attempts an
        // INSERT ... ON CONFLICT under the hood, which needs INSERT
        // privilege even when the row already exists and only the UPDATE
        // branch will ever fire. There is deliberately no INSERT policy on
        // `profiles`, so that upsert always gets a 403. A plain UPDATE is
        // both correct (the row is guaranteed to already exist once synced
        // this far) and doesn't need an INSERT grant at all.
        const { error } = item.table_name === 'profiles'
          ? await supabase.from('profiles').update(item.data).eq('id', item.data.id)
          : await supabase.from(item.table_name).upsert(item.data);

        if (!error) {
          // Si fue exitoso, lo sacamos de la cola
          await db.sync_queue.delete(item.id);
        } else {
          console.error(`Error pushing to ${item.table_name}:`, error);
          pushHadErrors = true;
        }
      }

      // Actualizar timestamp solo si el push del ciclo completó sin errores;
      // si falló, se reintenta todo el ciclo (pull + push) la próxima vez —
      // los upserts/puts son idempotentes.
      if (!pushHadErrors) {
        localStorage.setItem('last_sync', new Date().toISOString());
      }

    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      emitSyncCompleted();
    }
  }
}
