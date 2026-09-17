import { db } from '../../db/db';
import { IHabitRepository } from '../../../core/domain/repositories/IRepositories';
import { Habit, HabitCompletion, UUID } from '../../../core/domain/models/types';
import { uuidv7 } from 'uuidv7';

/**
 * Streak/token math is never computed here — recordCompletion just appends
 * to the log; evaluateHabitStreak.ts (a pure function) derives the current
 * streak/tokens from that log on read (Principio III, same "derive, don't
 * accumulate" pattern as calculateSharedBalance).
 */
export class LocalHabitRepository implements IHabitRepository {
  async getAll(userId: UUID): Promise<Habit[]> {
    return await db.habits.where('user_id').equals(userId).filter(h => !h.deleted_at).toArray();
  }

  async save(data: Omit<Habit, 'created_at' | 'updated_at'>): Promise<Habit> {
    const now = new Date();
    const id = data.id || uuidv7();
    const existing = await db.habits.get(id);

    let habit: Habit;
    if (existing) {
      habit = { ...existing, ...data, id, updated_at: now };
    } else {
      habit = { ...data, id, created_at: now, updated_at: now };
    }

    await db.habits.put(habit);
    return habit;
  }

  async delete(id: UUID): Promise<void> {
    const existing = await db.habits.get(id);
    if (existing) {
      await db.habits.put({ ...existing, deleted_at: new Date(), updated_at: new Date() });
    }
  }

  async getCompletions(habitId: UUID): Promise<HabitCompletion[]> {
    return await db.habit_completions.where('habit_id').equals(habitId).filter(c => !c.deleted_at).toArray();
  }

  async recordCompletion(habitId: UUID, date: Date, tokenUsed: boolean): Promise<HabitCompletion> {
    const now = new Date();
    const completion: HabitCompletion = {
      id: uuidv7(),
      habit_id: habitId,
      date,
      token_used: tokenUsed,
      created_at: now,
      updated_at: now,
    };
    await db.habit_completions.put(completion);
    return completion;
  }
}
