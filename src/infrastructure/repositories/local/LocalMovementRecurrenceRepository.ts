import { db } from '../../db/db';
import { evaluateMonthlyRecurrences } from '../../../core/use-cases/evaluateMonthlyRecurrences';
import { stableId } from '../../../core/use-cases/stableId';
export class LocalMovementRecurrenceRepository {
  async generate(userId: string, now: Date): Promise<void> {
    await db.transaction('rw', [db.movements, db.movement_recurrences, db.sync_queue], async () => {
      // Preserve old recurring entries by their own IDs, never by names/amounts.
      const all = await db.movements.where('user_id').equals(userId).toArray();
      for (const source of all.filter(row => row.is_recurring && !row.recurrence_rule_id && !row.deleted_at)) {
        const month = `${source.date.getFullYear()}-${String(source.date.getMonth() + 1).padStart(2, '0')}`;
        await db.movement_recurrences.put({ ...source, active: true, day_of_month: source.date.getDate(), activated_month: month });
        await db.movements.put({ ...source, recurrence_rule_id: source.id, recurrence_month: month });
      }
      const rules = await db.movement_recurrences.where('user_id').equals(userId).toArray();
      const occurrences = await db.movements.where('user_id').equals(userId).toArray();
      for (const occurrence of evaluateMonthlyRecurrences(rules, occurrences, now)) {
        await db.movements.put({ ...occurrence,
          id: stableId(`movement:${occurrence.recurrence_rule_id}:${occurrence.recurrence_month}`),
          created_at: now, updated_at: now,
        });
      }
    });
  }
}
