import { db } from '../../db/db';
import type { IMovementRecurrenceRepository } from '../../../core/domain/repositories/IRepositories';

export class LocalMovementRecurrenceRepository implements IMovementRecurrenceRepository {
  /**
   * Converts legacy recurring movements (created before recurrence rules existed)
   * into `movement_recurrences` rules without ever generating new occurrences
   * (FR-014, FR-018). Already-generated occurrences remain untouched.
   */
  async adoptLegacySources(userId: string): Promise<void> {
    await db.transaction('rw', [db.movements, db.movement_recurrences, db.sync_queue], async () => {
      // Preserve old recurring entries by their own IDs, never by names/amounts.
      const all = await db.movements.where('user_id').equals(userId).toArray();
      for (const source of all.filter(row => row.is_recurring && !row.recurrence_rule_id && !row.deleted_at)) {
        const month = `${source.date.getFullYear()}-${String(source.date.getMonth() + 1).padStart(2, '0')}`;
        await db.movement_recurrences.put({
          ...source,
          active: true,
          day_of_month: source.date.getDate(),
          activated_month: month,
        });
        await db.movements.put({
          ...source,
          recurrence_rule_id: source.id,
          recurrence_month: month,
        });
      }
    });
  }
}
