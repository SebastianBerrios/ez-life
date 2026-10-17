import { db } from '../../db/db';
import { ISyncStatusRepository } from '../../../core/domain/repositories/IRepositories';
import { UUID } from '../../../core/domain/models/types';

export class LocalSyncStatusRepository implements ISyncStatusRepository {
  /**
   * A record is "pending" while at least one snapshot of it sits in `sync_queue`. The queue is drained
   * by `CustomSyncLayer` after a successful push, so an id absent from it has reached the server
   * (or was pulled from it). A user who never signs in keeps everything pending, which is accurate.
   */
  async getPendingRecordIds(tableName: string): Promise<Set<UUID>> {
    const items = await db.sync_queue.filter(item => item.table_name === tableName).toArray();
    return new Set(items.map(item => String(item.data.id)));
  }
}
