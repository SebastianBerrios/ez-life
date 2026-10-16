import { db } from '../../db/db';
import type { IAchievementRepository } from '../../../core/domain/repositories/IAchievementRepository';
import { evaluateAchievements, reconcileAchievements, type AchievementId } from '../../../core/use-cases/evaluateAchievements';
import { stableId } from '../../../core/use-cases/stableId';

export class LocalAchievementRepository implements IAchievementRepository {
  async snapshot(userId: string) {
    const [movements, tasks, goals, habits, savingsGoals, receipts, profile] = await Promise.all([
      db.movements.where('user_id').equals(userId).toArray(),
      db.tasks.where('user_id').equals(userId).toArray(),
      db.goals.where('user_id').equals(userId).toArray(),
      db.habits.where('user_id').equals(userId).toArray(),
      db.savings_goals.where('user_id').equals(userId).toArray(),
      db.achievement_receipts.where('user_id').equals(userId).toArray(),
      db.profiles.get(userId),
    ]);
    const completions = (await Promise.all(habits.map(h => db.habit_completions.where('habit_id').equals(h.id).toArray()))).flat();
    return { data: { movements, tasks, goals, habits, savingsGoals, completions }, receipts, profile };
  }

  async reconcile(userId: string, now = new Date()): Promise<AchievementId[]> {
    return db.transaction('rw', [db.movements, db.tasks, db.goals, db.habits, db.habit_completions, db.savings_goals, db.profiles, db.achievement_receipts, db.notifications], async () => {
      const { data, receipts, profile } = await this.snapshot(userId);
      if (!profile || profile.deleted_at) return [];
      const updates = reconcileAchievements(evaluateAchievements(data, now), receipts, data);
      const celebrated: AchievementId[] = [];
      for (const update of updates) {
        const existing = receipts.find(r => r.achievement_id === update.id);
        if (existing && existing.celebration_handled === update.handled) continue;
        await db.achievement_receipts.put({
          id: stableId(`achievement:${userId}:${update.id}`), user_id: userId,
          achievement_id: update.id, celebration_handled: update.handled,
          created_at: existing?.created_at ?? now, updated_at: now,
        });
        if (update.celebrate && profile.gamification_enabled !== false && profile.inapp_enabled !== false) {
          const id = stableId(`achievement-notification:${userId}:${update.id}`);
          if (!await db.notifications.get(id)) {
            await db.notifications.put({ id, user_id: userId, type: 'achievement_unlocked',
              title: 'Un nuevo logro personal', body: 'Tu constancia suma. Mira lo que has alcanzado en Mi progreso.',
              related_id: update.id, created_at: now, updated_at: now });
            celebrated.push(update.id);
          }
        }
      }
      return celebrated;
    });
  }
}
