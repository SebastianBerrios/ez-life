import { db } from '../db/db';
import { getSupabaseBrowserClient } from '../supabase/client';

const supabase = getSupabaseBrowserClient();

export class CustomSyncLayer {
  private isSyncing = false;

  async sync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Pull: Obtener cambios remotos
      const lastSyncStr = localStorage.getItem('last_sync') || new Date(0).toISOString();
      const lastSyncDate = new Date(lastSyncStr);

      const tablesToSync = [
        'profiles', 'income_sources', 'distribution_categories',
        'expense_categories', 'expense_subcategories', 'savings_goals', 'movements'
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

        // Resolve conflicts (Last-Write-Wins)
        if (remoteData && remoteData.length > 0) {
          const localTable = db.table(tableName);
          for (const remoteRecord of remoteData) {
            const localRecord = await localTable.get(remoteRecord.id);
            if (!localRecord || new Date(remoteRecord.updated_at) > new Date(localRecord.updated_at)) {
              await localTable.put(remoteRecord); // Remote wins
            }
          }
        }
      }

      // 2. Push: Subir cambios pendientes locales
      const pendingQueue = await db.sync_queue.orderBy('created_at').toArray();
      
      for (const item of pendingQueue) {
        const { error } = await supabase
          .from(item.table_name)
          .upsert(item.data);
          
        if (!error) {
          // Si fue exitoso, lo sacamos de la cola
          await db.sync_queue.delete(item.id);
        } else {
          console.error(`Error pushing to ${item.table_name}:`, error);
        }
      }

      // Actualizar timestamp
      localStorage.setItem('last_sync', new Date().toISOString());

    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}
